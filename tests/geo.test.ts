import { afterEach, describe, expect, it, test, vi } from 'vitest';
import { fetchDailyWeather, weatherMeta } from '../src/lib/geo';
import { toISODate } from '../src/models/types';

/* ===== weatherMeta：所有 WMO 代碼 0..99 都要有合理輸出 ===== */
describe('weatherMeta', () => {
  const codes = Array.from({ length: 100 }, (_, i) => i);

  test.each(codes)('代碼 %i 有 emoji 與說明', (code) => {
    const meta = weatherMeta(code);
    expect(meta.emoji.length).toBeGreaterThan(0);
    expect(meta.label.length).toBeGreaterThan(0);
  });

  it('關鍵代碼對應', () => {
    expect(weatherMeta(0).emoji).toBe('☀️');
    expect(weatherMeta(1).emoji).toBe('🌤️');
    expect(weatherMeta(3).emoji).toBe('☁️');
    expect(weatherMeta(45).emoji).toBe('🌫️');
    expect(weatherMeta(51).emoji).toBe('🌦️');
    expect(weatherMeta(61).emoji).toBe('🌧️');
    expect(weatherMeta(71).emoji).toBe('🌨️');
    expect(weatherMeta(80).emoji).toBe('🌧️');
    expect(weatherMeta(85).emoji).toBe('🌨️');
    expect(weatherMeta(95).emoji).toBe('⛈️');
  });
});

/* ===== fetchDailyWeather：日期夾取與快取 ===== */
describe('fetchDailyWeather', () => {
  afterEach(() => vi.unstubAllGlobals());

  function futureDate(days: number): string {
    return toISODate(new Date(Date.now() + days * 86400000));
  }

  it('整段日期都在過去 → 不打 API、回空 Map', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const result = await fetchDailyWeather(16, 108, '2020-01-01', '2020-01-05');
    expect(result.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('整段日期超過 16 天預報範圍 → 不打 API、回空 Map', async () => {
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    const result = await fetchDailyWeather(16, 108, futureDate(30), futureDate(35));
    expect(result.size).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it('範圍內 → 解析每日資料並夾取到今天~+15天', async () => {
    const from = futureDate(0);
    const to = futureDate(2);
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          time: [from, futureDate(1), to],
          weather_code: [0, 61, 95],
          temperature_2m_max: [33.4, 30.1, 28.9],
          temperature_2m_min: [26.2, 25.0, 24.4],
        },
      }),
    });
    vi.stubGlobal('fetch', spy);

    // 起點在過去、終點在範圍內 → 起點被夾到今天
    const result = await fetchDailyWeather(16.06, 108.22, '2020-01-01', to);
    expect(spy).toHaveBeenCalledTimes(1);
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain(`start_date=${from}`);
    expect(url).toContain(`end_date=${to}`);
    expect(result.size).toBe(3);
    expect(result.get(from)).toEqual({ date: from, code: 0, tMax: 33, tMin: 26 });
    expect(result.get(to)?.code).toBe(95);
  });

  it('相同參數第二次呼叫用快取、不重打 API', async () => {
    const from = futureDate(3);
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        daily: {
          time: [from],
          weather_code: [2],
          temperature_2m_max: [20],
          temperature_2m_min: [10],
        },
      }),
    });
    vi.stubGlobal('fetch', spy);

    await fetchDailyWeather(35.01, 135.76, from, from);
    await fetchDailyWeather(35.01, 135.76, from, from);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('API 失敗 → 拋出錯誤', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(fetchDailyWeather(1.23, 4.56, futureDate(5), futureDate(6))).rejects.toThrow();
  });
});
