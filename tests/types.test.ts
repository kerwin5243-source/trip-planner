import { describe, expect, it, test } from 'vitest';
import {
  addMinutes,
  createTrip,
  dateRange,
  toISODate,
  totalDays,
} from '../src/models/types';

/* ===== addMinutes：時刻 × 時長全面掃描 ===== */
describe('addMinutes', () => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = [0, 1, 15, 30, 45, 59];
  const durations = [0, 1, 15, 60, 90, 720, 1439, 1440, 2880];

  const cases: Array<[string, number, string]> = [];
  for (const h of hours) {
    for (const m of mins) {
      for (const d of durations) {
        const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        const total = (((h * 60 + m + d) % 1440) + 1440) % 1440;
        const expected = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(
          total % 60,
        ).padStart(2, '0')}`;
        cases.push([time, d, expected]);
      }
    }
  }

  test.each(cases)('%s + %i 分鐘 = %s', (time, minutes, expected) => {
    const result = addMinutes(time, minutes);
    expect(result).toBe(expected);
    expect(result).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });

  it('跨午夜繞回', () => {
    expect(addMinutes('23:30', 60)).toBe('00:30');
    expect(addMinutes('00:00', 1440)).toBe('00:00');
  });
});

/* ===== dateRange：跨月、跨年、閏年 ===== */
describe('dateRange', () => {
  const starts: string[] = [];
  for (const year of [2024, 2025, 2026]) {
    for (let month = 1; month <= 12; month++) {
      starts.push(`${year}-${String(month).padStart(2, '0')}-27`); // 跨月邊界
      starts.push(`${year}-${String(month).padStart(2, '0')}-01`);
    }
  }

  const cases: Array<[string, number]> = [];
  for (const start of starts) {
    for (const len of [1, 2, 5, 10]) cases.push([start, len]);
  }

  test.each(cases)('從 %s 起 %i 天', (start, len) => {
    const d = new Date(`${start}T00:00:00`);
    d.setDate(d.getDate() + len - 1);
    const end = toISODate(d);
    const range = dateRange(start, end);
    expect(range).toHaveLength(len);
    expect(range[0]).toBe(start);
    expect(range[range.length - 1]).toBe(end);
    // 日期必須連續
    for (let i = 1; i < range.length; i++) {
      const prev = new Date(`${range[i - 1]}T00:00:00`);
      prev.setDate(prev.getDate() + 1);
      expect(range[i]).toBe(toISODate(prev));
    }
  });

  it('閏年 2/29', () => {
    expect(dateRange('2024-02-28', '2024-03-01')).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it('非閏年直接跳 3/1', () => {
    expect(dateRange('2026-02-28', '2026-03-01')).toEqual(['2026-02-28', '2026-03-01']);
  });

  it('跨年', () => {
    expect(dateRange('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
  });

  it('起訖同天 = 1 天', () => {
    expect(dateRange('2026-07-09', '2026-07-09')).toEqual(['2026-07-09']);
  });
});

/* ===== createTrip：1~60 天都要生成正確的每日行程 ===== */
describe('createTrip', () => {
  const lengths = Array.from({ length: 60 }, (_, i) => i + 1);

  test.each(lengths)('%i 天的旅程', (len) => {
    const start = '2026-10-01';
    const d = new Date(`${start}T00:00:00`);
    d.setDate(d.getDate() + len - 1);
    const end = toISODate(d);

    const trip = createTrip({ title: '測試', startDate: start, endDate: end });
    expect(trip.daySchedules).toHaveLength(len);
    expect(totalDays(trip)).toBe(len);
    expect(trip.daySchedules[0].date).toBe(start);
    expect(trip.daySchedules[len - 1].date).toBe(end);
    expect(trip.daySchedules.every((day) => day.items.length === 0)).toBe(true);
    expect(trip.id).toMatch(/[0-9a-f-]{36}/);
    expect(trip.enabledModules).toContain('itinerary');
  });
});

/* ===== toISODate：全年 365 天格式正確 ===== */
describe('toISODate', () => {
  const days = Array.from({ length: 365 }, (_, i) => i);

  test.each(days)('2026 年第 %i 天', (offset) => {
    const d = new Date(2026, 0, 1 + offset);
    const iso = toISODate(d);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const round = new Date(`${iso}T00:00:00`);
    expect(round.getFullYear()).toBe(d.getFullYear());
    expect(round.getMonth()).toBe(d.getMonth());
    expect(round.getDate()).toBe(d.getDate());
  });
});
