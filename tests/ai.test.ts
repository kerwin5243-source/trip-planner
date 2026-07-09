import { describe, expect, it, test } from 'vitest';
import { buildPrompt, parseAIItinerary } from '../src/lib/ai';

const valid = JSON.stringify({
  title: '峴港五日',
  days: [
    { items: [{ arrivalTime: '09:00', title: '龍橋', type: 'attraction', durationMinutes: 60, description: '看噴火' }] },
    { items: [] },
  ],
});

describe('parseAIItinerary 正常路徑', () => {
  it('純 JSON', () => {
    const r = parseAIItinerary(valid);
    expect(r.title).toBe('峴港五日');
    expect(r.days).toHaveLength(2);
    expect(r.days[0].items[0].title).toBe('龍橋');
  });

  it('容忍 ```json 圍欄', () => {
    expect(parseAIItinerary('```json\n' + valid + '\n```').title).toBe('峴港五日');
  });

  it('容忍前後說明文字', () => {
    expect(parseAIItinerary('好的，這是行程：\n' + valid + '\n希望你玩得開心！').title).toBe(
      '峴港五日',
    );
  });
});

describe('parseAIItinerary 清洗與預設值', () => {
  const invalidTimes = ['9:5', '25:00', '12:60', 'abc', '', '099:00'];
  test.each(invalidTimes)('無效時間 %j → 預設 09:00', (time) => {
    const r = parseAIItinerary(
      JSON.stringify({ days: [{ items: [{ arrivalTime: time, title: 'x' }] }] }),
    );
    expect(r.days[0].items[0].arrivalTime).toBe('09:00');
  });

  const validTimes = ['00:00', '23:59', '09:30', '12:00', '05:07'];
  test.each(validTimes)('有效時間 %j 保留', (time) => {
    const r = parseAIItinerary(
      JSON.stringify({ days: [{ items: [{ arrivalTime: time, title: 'x' }] }] }),
    );
    expect(r.days[0].items[0].arrivalTime).toBe(time);
  });

  const badTypes = ['sightseeing', '', null, 42, 'ATTRACTION'];
  test.each(badTypes)('無效種類 %j → attraction', (type) => {
    const r = parseAIItinerary(JSON.stringify({ days: [{ items: [{ title: 'x', type }] }] }));
    expect(r.days[0].items[0].type).toBe('attraction');
  });

  const badDurations = [-5, 0, 'abc', null, undefined];
  test.each(badDurations)('無效時長 %j → 60 分鐘', (d) => {
    const r = parseAIItinerary(
      JSON.stringify({ days: [{ items: [{ title: 'x', durationMinutes: d }] }] }),
    );
    expect(r.days[0].items[0].durationMinutes).toBe(60);
  });

  it('缺 title → 預設名稱', () => {
    const r = parseAIItinerary(JSON.stringify({ days: [{ items: [] }] }));
    expect(r.title).toBe('AI 生成旅程');
  });

  it('小數時長四捨五入', () => {
    const r = parseAIItinerary(
      JSON.stringify({ days: [{ items: [{ title: 'x', durationMinutes: 45.6 }] }] }),
    );
    expect(r.days[0].items[0].durationMinutes).toBe(46);
  });
});

describe('parseAIItinerary 錯誤路徑', () => {
  const garbage = ['', '哈囉', '[1,2,3]', '{"title":"x"}', '{"days":[]}', '{{{{', '{"days":"x"}'];
  test.each(garbage)('拒絕 %j', (text) => {
    expect(() => parseAIItinerary(text)).toThrow();
  });
});

describe('buildPrompt', () => {
  it('包含目的地與天數', () => {
    const p = buildPrompt({
      destination: '京都',
      startDate: '2026-10-01',
      endDate: '2026-10-05',
      preferences: '慢步調',
    });
    expect(p).toContain('京都');
    expect(p).toContain('共 5 天');
    expect(p).toContain('慢步調');
    expect(p).toContain('days 陣列必須剛好 5 個元素');
  });

  it('沒有偏好時不出現偏好行', () => {
    const p = buildPrompt({
      destination: '京都',
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      preferences: '  ',
    });
    expect(p).not.toContain('偏好與需求');
  });
});
