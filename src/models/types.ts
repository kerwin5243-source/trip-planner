/**
 * ============================
 * 核心資料模型
 * ============================
 * 由 FRP (Flutter 版) 的 lib/models/*.dart 移植而來。
 * 日期一律使用 ISO 字串 (yyyy-MM-dd)，時間使用 "HH:mm"，方便 JSON 序列化與同步。
 */

/** 旅行模板類型 */
export type TemplateType = 'basic' | 'adventure' | 'relaxation' | 'cultural' | 'custom';

/** 背景類型 */
export type BackgroundType =
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'sakura'
  | 'mountain'
  | 'starry'
  | 'custom';

/** 行程種類 (景點、交通、住宿、餐廳) */
export type ItineraryItemType = 'attraction' | 'transport' | 'accommodation' | 'restaurant';

/** 單一行程項目 (卡片) */
export interface ItineraryItem {
  id: string;
  arrivalTime: string; // 抵達時間 "HH:mm"
  title: string; // 標題
  type: ItineraryItemType; // 種類
  durationMinutes: number; // 停留時間 (分鐘)
  description: string; // 詳細描述
  precautions: string; // 注意事項
  guideInfo: string; // Guide 介紹
  imagePath?: string; // 照片路徑
  reservationNo: string; // 預約編號
  address: string; // 地址
  mapCode: string; // MapCode
  url: string; // 網站連結
  isSplash: boolean; // 是否為重點行程
}

/** 旅行大綱 — 每日重點概覽 */
export interface TripSummaryItem {
  dayNumber: number;
  highlight: string;
  notes: string;
}

/** 單日行程 */
export interface DaySchedule {
  date: string; // yyyy-MM-dd
  items: ItineraryItem[];
  highlightImages: string[]; // 專屬這一天的輪播相簿
}

/** 主要的旅行模型 */
export interface Trip {
  id: string;
  title: string;
  templateType: TemplateType;
  backgroundType: BackgroundType;
  customBackgroundPath?: string;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd
  summaries: TripSummaryItem[];
  daySchedules: DaySchedule[];
  enabledModules: string[];
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime，為未來帳號同步預留
}

/* ============================
 * 記帳模型（第三階段使用，先定義好資料表結構避免日後遷移）
 * ============================ */

export type MemberType = 'self' | 'virtual' | 'friend';

export interface ExpenseMember {
  id: string;
  name: string;
  type: MemberType;
  avatarEmoji?: string;
}

export type ExpenseCategory =
  | 'food'
  | 'transport'
  | 'accommodation'
  | 'shopping'
  | 'entertainment'
  | 'ticket'
  | 'other';

export interface ExpenseRecord {
  id: string;
  tripId: string;
  amount: number;
  currency: string; // TWD, JPY, USD...
  category: ExpenseCategory;
  description: string;
  paidById: string;
  splitWithIds: string[];
  date: string; // yyyy-MM-dd
  createdAt: string;
}

/* ============================
 * 交通路線模型
 * ============================
 * FRP 原版只有 type/from/to/note 且未持久化；Web 版補上日期與時間並存入資料庫。
 */

export type TransportType =
  | 'flight'
  | 'train'
  | 'bus'
  | 'metro'
  | 'taxi'
  | 'walk'
  | 'drive'
  | 'other';

export const transportTypeMeta: Record<TransportType, { label: string; emoji: string }> = {
  flight: { label: '飛機', emoji: '✈️' },
  train: { label: '火車', emoji: '🚄' },
  bus: { label: '公車', emoji: '🚌' },
  metro: { label: '捷運', emoji: '🚇' },
  taxi: { label: '計程車', emoji: '🚕' },
  walk: { label: '步行', emoji: '🚶' },
  drive: { label: '自駕', emoji: '🚗' },
  other: { label: '其他', emoji: '🧭' },
};

export interface TransportEntry {
  id: string;
  tripId: string;
  date: string; // yyyy-MM-dd
  departTime: string; // "HH:mm"，可為空字串
  type: TransportType;
  from: string; // 出發地
  to: string; // 目的地
  note: string; // 備註（例如：新幹線自由席）
  createdAt: string;
}

/* ============================
 * 行前準備清單模型
 * ============================ */

export interface PackingItem {
  id: string;
  tripId: string;
  name: string;
  icon: string; // emoji 或 icon 名稱（Web 版以 emoji 取代 Flutter IconData）
  isPacked: boolean;
  quantity: number;
  isCustom: boolean;
}

/* ============================
 * 伴手禮紀錄模型
 * ============================ */

export interface Souvenir {
  id: string;
  tripId: string;
  name: string;
  description?: string;
  expectedPrice: number;
  imageUrl?: string;
  isPurchased: boolean;
  recipient: string; // 代買/送給誰
  region: string; // 地區 (如：高松、德島)
  createdAt: string;
}

/* ============================
 * 世界地圖迷霧模型
 * ============================ */

export interface VisitedCountry {
  code: string; // ISO 3166-1 alpha-2（例如 JP、KR）
  name: string; // 顯示名稱（記錄當下的中文名）
  visitedAt: string; // 標記時間
}

/* ============================
 * 工廠函式與輔助工具
 * ============================ */

export const uuid = (): string => crypto.randomUUID();

/** 今天的 yyyy-MM-dd（本地時區） */
export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 產生 start~end（含）之間的所有日期 */
export function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (cur <= end) {
    dates.push(toISODate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/** 建立一趟新旅行，依日期範圍自動生成每日行程 */
export function createTrip(params: {
  title: string;
  startDate: string;
  endDate: string;
  templateType?: TemplateType;
  backgroundType?: BackgroundType;
}): Trip {
  const now = new Date().toISOString();
  const daySchedules: DaySchedule[] = dateRange(params.startDate, params.endDate).map((date) => ({
    date,
    items: [],
    highlightImages: [],
  }));
  return {
    id: uuid(),
    title: params.title,
    templateType: params.templateType ?? 'basic',
    backgroundType: params.backgroundType ?? 'ocean',
    startDate: params.startDate,
    endDate: params.endDate,
    summaries: [],
    daySchedules,
    enabledModules: ['itinerary', 'transportation', 'expenses', 'packing', 'souvenir'],
    createdAt: now,
    updatedAt: now,
  };
}

export function totalDays(trip: Trip): number {
  return dateRange(trip.startDate, trip.endDate).length;
}

/** 行程種類的顯示名稱與 emoji */
export const itineraryTypeMeta: Record<ItineraryItemType, { label: string; emoji: string }> = {
  attraction: { label: '景點', emoji: '📍' },
  transport: { label: '交通', emoji: '🚃' },
  accommodation: { label: '住宿', emoji: '🏨' },
  restaurant: { label: '餐廳', emoji: '🍜' },
};

/** 背景漸層定義（與 FRP 的 BackgroundType 對應） */
export const backgroundGradients: Record<BackgroundType, string> = {
  ocean: 'linear-gradient(135deg, #1a6dab 0%, #5fc3e4 100%)',
  sunset: 'linear-gradient(135deg, #e96443 0%, #f7b733 100%)',
  forest: 'linear-gradient(135deg, #11724d 0%, #6fbf8b 100%)',
  sakura: 'linear-gradient(135deg, #d46a9c 0%, #f8c6d8 100%)',
  mountain: 'linear-gradient(135deg, #485563 0%, #8ba0b3 100%)',
  starry: 'linear-gradient(135deg, #2b1e5e 0%, #6c4ab6 100%)',
  custom: 'linear-gradient(135deg, #4b5563 0%, #9ca3af 100%)',
};

export const backgroundNames: Record<BackgroundType, string> = {
  ocean: '海洋藍',
  sunset: '夕陽暖橘',
  forest: '森林綠',
  sakura: '櫻花粉',
  mountain: '山嶽灰藍',
  starry: '星空深紫',
  custom: '自訂',
};

/** 開銷分類的顯示名稱與 emoji（對應 FRP 的 expenseCategoryName） */
export const expenseCategoryMeta: Record<ExpenseCategory, { label: string; emoji: string }> = {
  food: { label: '餐飲', emoji: '🍜' },
  transport: { label: '交通', emoji: '🚃' },
  accommodation: { label: '住宿', emoji: '🏨' },
  shopping: { label: '購物', emoji: '🛍️' },
  entertainment: { label: '娛樂', emoji: '🎡' },
  ticket: { label: '門票', emoji: '🎫' },
  other: { label: '其他', emoji: '📦' },
};

/** 常用幣別 */
export const currencies = ['TWD', 'JPY', 'KRW', 'USD', 'EUR', 'CNY', 'THB', 'SGD'] as const;

/** 建立一筆開銷紀錄 */
export function createExpense(params: {
  tripId: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  description: string;
  paidById: string;
  splitWithIds: string[];
  date: string;
}): ExpenseRecord {
  return {
    id: uuid(),
    createdAt: new Date().toISOString(),
    ...params,
  };
}

/**
 * 預設行前準備項目（對應 FRP 的 getDefaultPackingItems）。
 * id 用 tripId 組成固定值，重複 bulkPut 不會產生重複項目。
 */
export function defaultPackingItems(tripId: string): PackingItem[] {
  const defaults: Array<{ key: string; name: string; icon: string; quantity?: number }> = [
    { key: 'passport', name: '護照', icon: '🛂' },
    { key: 'wallet', name: '錢包', icon: '👛' },
    { key: 'visa', name: '簽證', icon: '📄' },
    { key: 'toiletries', name: '盥洗用具', icon: '🧼' },
    { key: 'clothes_1', name: '衣服', icon: '👕', quantity: 3 },
    { key: 'charger', name: '充電器', icon: '🔌' },
    { key: 'medicine', name: '常備藥品', icon: '💊' },
    { key: 'umbrella', name: '雨具', icon: '☂️' },
    { key: 'camera', name: '相機', icon: '📷' },
    { key: 'ticket', name: '機票', icon: '✈️' },
    { key: 'sunscreen', name: '防曬用品', icon: '☀️' },
    { key: 'adapter', name: '轉接頭', icon: '⚡' },
  ];
  return defaults.map((d) => ({
    id: `${tripId}:${d.key}`,
    tripId,
    name: d.name,
    icon: d.icon,
    isPacked: false,
    quantity: d.quantity ?? 1,
    isCustom: false,
  }));
}

export const templateNames: Record<TemplateType, string> = {
  basic: '基本',
  adventure: '冒險',
  relaxation: '休閒',
  cultural: '文化之旅',
  custom: '自定義',
};
