/**
 * ============================
 * 地點搜尋 (Nominatim/OSM) 與天氣 (Open-Meteo)
 * ============================
 * 兩個都是免 API key 的公開服務（TREK 同款方案）。
 * Nominatim 使用禮節：頻率低、由使用者主動觸發搜尋（非每鍵即查）。
 */
import { todayISO, toISODate, type PlaceRef } from '../models/types';

export async function searchPlaces(query: string): Promise<PlaceRef[]> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=zh-TW&q=' +
    encodeURIComponent(query);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`地點搜尋失敗 (${res.status})`);
  const rows = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return rows.map((r) => ({ name: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
}

export interface DayWeather {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
}

/** WMO weather code → emoji 與說明 */
export function weatherMeta(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: '☀️', label: '晴朗' };
  if (code <= 2) return { emoji: '🌤️', label: '多雲時晴' };
  if (code === 3) return { emoji: '☁️', label: '陰天' };
  if (code === 45 || code === 48) return { emoji: '🌫️', label: '有霧' };
  if (code <= 57) return { emoji: '🌦️', label: '毛毛雨' };
  if (code <= 67) return { emoji: '🌧️', label: '下雨' };
  if (code <= 77) return { emoji: '🌨️', label: '下雪' };
  if (code <= 82) return { emoji: '🌧️', label: '陣雨' };
  if (code <= 86) return { emoji: '🌨️', label: '陣雪' };
  return { emoji: '⛈️', label: '雷雨' };
}

const weatherCache = new Map<string, Map<string, DayWeather>>();

/**
 * 抓取每日天氣預報。Open-Meteo 預報最多約 16 天，
 * 超出範圍的日期不會出現在回傳的 Map 裡。
 */
export async function fetchDailyWeather(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string,
): Promise<Map<string, DayWeather>> {
  const today = todayISO();
  const maxDate = toISODate(new Date(Date.now() + 15 * 86400000));
  const from = startDate < today ? today : startDate;
  const to = endDate > maxDate ? maxDate : endDate;
  if (from > to) return new Map();

  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${from},${to}`;
  const cached = weatherCache.get(key);
  if (cached) return cached;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
    `&timezone=auto&start_date=${from}&end_date=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`天氣查詢失敗 (${res.status})`);
  const body = (await res.json()) as {
    daily?: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
    };
  };
  const map = new Map<string, DayWeather>();
  body.daily?.time.forEach((date, i) => {
    map.set(date, {
      date,
      code: body.daily!.weather_code[i],
      tMax: Math.round(body.daily!.temperature_2m_max[i]),
      tMin: Math.round(body.daily!.temperature_2m_min[i]),
    });
  });
  weatherCache.set(key, map);
  return map;
}
