/**
 * ============================
 * AI 行程生成
 * ============================
 * 兩種模式共用同一套提示詞與解析：
 * 1. 有 Anthropic API key：瀏覽器直接呼叫 Claude API（structured outputs 保證合法 JSON）
 * 2. 沒有 key：複製提示詞貼到任何 AI，把回傳的 JSON 貼回來匯入
 */
import { dateRange, type ItineraryItemType } from '../models/types';

export interface AIItineraryItem {
  arrivalTime: string;
  title: string;
  type: ItineraryItemType;
  durationMinutes: number;
  description: string;
}

export interface AIItinerary {
  title: string;
  days: { items: AIItineraryItem[] }[];
}

const VALID_TYPES: ItineraryItemType[] = ['attraction', 'transport', 'accommodation', 'restaurant'];

/** structured outputs 用的 JSON schema（不放數值/長度限制 — API 不支援） */
export const itinerarySchema = {
  type: 'object',
  properties: {
    title: { type: 'string', description: '旅程名稱（繁體中文，簡短有旅行感）' },
    days: {
      type: 'array',
      description: '每天一個元素，順序對應旅程日期',
      items: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                arrivalTime: { type: 'string', description: '抵達時間 HH:mm（24 小時制）' },
                title: { type: 'string', description: '行程名稱（繁體中文）' },
                type: { type: 'string', enum: VALID_TYPES },
                durationMinutes: { type: 'integer', description: '停留分鐘數' },
                description: { type: 'string', description: '一兩句介紹或提醒' },
              },
              required: ['arrivalTime', 'title', 'type', 'durationMinutes', 'description'],
              additionalProperties: false,
            },
          },
        },
        required: ['items'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'days'],
  additionalProperties: false,
} as const;

export interface AIParams {
  destination: string;
  startDate: string;
  endDate: string;
  preferences: string;
}

export function buildPrompt(params: AIParams): string {
  const days = dateRange(params.startDate, params.endDate);
  return [
    `請幫我規劃一趟「${params.destination}」的旅程。`,
    `日期：${params.startDate} 到 ${params.endDate}，共 ${days.length} 天。`,
    params.preferences.trim() && `偏好與需求：${params.preferences.trim()}`,
    '',
    '要求：',
    `- 每天安排 3 到 6 個行程項目（景點/餐廳/交通/住宿），時間合理、動線順路`,
    '- 使用繁體中文',
    `- 回傳純 JSON（不要 markdown 圍欄、不要多餘文字），格式如下：`,
    JSON.stringify(
      {
        title: '旅程名稱',
        days: [
          {
            items: [
              {
                arrivalTime: '09:00',
                title: '行程名稱',
                type: 'attraction | transport | accommodation | restaurant',
                durationMinutes: 90,
                description: '一兩句介紹',
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
    `- days 陣列必須剛好 ${days.length} 個元素，依日期順序`,
  ]
    .filter((line, i) => line !== '' || i === 3) // 保留刻意的空行分隔（索引 3）
    .join('\n');
}

/** 解析並清洗 AI 回傳的 JSON（也容忍 ```json 圍欄與前後雜訊） */
export function parseAIItinerary(text: string): AIItinerary {
  let raw = text.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) raw = fenced[1].trim();
  // 容忍 JSON 前後有說明文字：取第一個 { 到最後一個 }
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last <= first) throw new Error('找不到 JSON 內容');
  raw = raw.slice(first, last + 1);

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('JSON 格式錯誤，請確認完整複製了 AI 的回覆');
  }
  const obj = data as { title?: unknown; days?: unknown };
  if (!Array.isArray(obj.days) || obj.days.length === 0) {
    throw new Error('JSON 裡沒有 days 陣列');
  }

  const days = obj.days.map((d) => {
    const items = Array.isArray((d as { items?: unknown })?.items)
      ? ((d as { items: unknown[] }).items as Array<Record<string, unknown>>)
      : [];
    return {
      items: items.map((it): AIItineraryItem => {
        const time = typeof it.arrivalTime === 'string' ? it.arrivalTime.trim() : '';
        return {
          arrivalTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '09:00',
          title: typeof it.title === 'string' && it.title.trim() ? it.title.trim() : '未命名行程',
          type: VALID_TYPES.includes(it.type as ItineraryItemType)
            ? (it.type as ItineraryItemType)
            : 'attraction',
          durationMinutes:
            typeof it.durationMinutes === 'number' && it.durationMinutes > 0
              ? Math.round(it.durationMinutes)
              : 60,
          description: typeof it.description === 'string' ? it.description : '',
        };
      }),
    };
  });

  return {
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : 'AI 生成旅程',
    days,
  };
}

const API_KEY_STORAGE = 'tp-anthropic-key';

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) ?? '';
}

export function storeApiKey(key: string): void {
  if (key) localStorage.setItem(API_KEY_STORAGE, key);
  else localStorage.removeItem(API_KEY_STORAGE);
}

interface AnthropicResponse {
  stop_reason?: string;
  error?: { message?: string };
  content?: Array<{ type: string; text?: string }>;
}

/**
 * 用使用者自己的 API key 直接呼叫 Claude 生成行程。
 * 直接打 Messages API（不透過 SDK），省下瀏覽器端的 Node polyfill 與額外 bundle。
 * anthropic-dangerous-direct-browser-access 標頭讓瀏覽器 CORS 請求被接受。
 */
export async function generateItinerary(apiKey: string, params: AIParams): Promise<AIItinerary> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: itinerarySchema } },
      messages: [{ role: 'user', content: buildPrompt(params) }],
    }),
  });

  const data = (await res.json().catch(() => ({}))) as AnthropicResponse;
  if (!res.ok) {
    const msg = data.error?.message ?? `伺服器回應 ${res.status}`;
    if (res.status === 401) throw new Error('API key 無效，請確認後再試');
    throw new Error(`呼叫 Claude 失敗：${msg}`);
  }
  if (data.stop_reason === 'refusal') {
    throw new Error('AI 拒絕了這個請求，請調整描述後再試');
  }
  const text = data.content?.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('AI 沒有回傳內容');
  return parseAIItinerary(text);
}
