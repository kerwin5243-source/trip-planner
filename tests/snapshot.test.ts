import { beforeEach, describe, expect, test } from 'vitest';
import { db, deleteTrip, saveTrip } from '../src/db/db';
import { exportSnapshot, importSnapshot } from '../src/lib/sync';
import {
  createTrip,
  createExpense,
  defaultPackingItems,
  uuid,
  type ExpenseCategory,
  type Souvenir,
  type TransportEntry,
  type TransportType,
  type Trip,
  type VisitedCountry,
} from '../src/models/types';

const categories: ExpenseCategory[] = [
  'food',
  'transport',
  'accommodation',
  'shopping',
  'entertainment',
  'ticket',
  'other',
];
const transportTypes: TransportType[] = [
  'flight',
  'train',
  'bus',
  'metro',
  'taxi',
  'walk',
  'drive',
  'other',
];
const currencies = ['TWD', 'JPY', 'KRW', 'USD'];

let seed = 7;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

/** 產生一個隨機但完整的旅程與其附屬資料 */
async function seedRandomTrip(): Promise<string> {
  const trip: Trip = createTrip({
    title: `旅程-${Math.floor(rand() * 10000)}`,
    startDate: '2026-10-01',
    endDate: '2026-10-05',
  });
  // 隨機塞行程項目
  trip.daySchedules = trip.daySchedules.map((d) => ({
    ...d,
    items: Array.from({ length: Math.floor(rand() * 4) }, () => ({
      id: uuid(),
      arrivalTime: `${String(Math.floor(rand() * 24)).padStart(2, '0')}:00`,
      title: `景點-${Math.floor(rand() * 1000)}`,
      type: 'attraction' as const,
      durationMinutes: 60,
      description: '',
      precautions: '',
      guideInfo: '',
      reservationNo: '',
      address: '',
      mapCode: '',
      url: '',
      isSplash: rand() > 0.7,
    })),
  }));
  await saveTrip(trip);

  const nExpenses = Math.floor(rand() * 5);
  for (let i = 0; i < nExpenses; i++) {
    await db.expenses.add(
      createExpense({
        tripId: trip.id,
        amount: Math.round(rand() * 5000),
        currency: pick(currencies),
        category: pick(categories),
        description: `花費-${i}`,
        paidById: 'self',
        splitWithIds: [],
        date: '2026-10-02',
      }),
    );
  }

  await db.packingItems.bulkPut(defaultPackingItems(trip.id));

  const nSouvenirs = Math.floor(rand() * 4);
  for (let i = 0; i < nSouvenirs; i++) {
    const s: Souvenir = {
      id: uuid(),
      tripId: trip.id,
      name: `伴手禮-${i}`,
      expectedPrice: Math.round(rand() * 1000),
      isPurchased: rand() > 0.5,
      recipient: '',
      region: pick(['高松', '德島', '未分類']),
      createdAt: new Date().toISOString(),
    };
    await db.souvenirs.add(s);
  }

  const nTransports = Math.floor(rand() * 3);
  for (let i = 0; i < nTransports; i++) {
    const t: TransportEntry = {
      id: uuid(),
      tripId: trip.id,
      date: '2026-10-01',
      departTime: '08:00',
      type: pick(transportTypes),
      from: `A${i}`,
      to: `B${i}`,
      note: '',
      createdAt: new Date().toISOString(),
    };
    await db.transports.add(t);
  }

  return trip.id;
}

describe('資料庫 CRUD 與快照往返（隨機情境）', () => {
  beforeEach(async () => {
    await Promise.all([
      db.trips.clear(),
      db.expenses.clear(),
      db.expenseMembers.clear(),
      db.packingItems.clear(),
      db.souvenirs.clear(),
      db.transports.clear(),
      db.visitedCountries.clear(),
    ]);
  });

  const scenarios = Array.from({ length: 120 }, (_, i) => i);

  test.each(scenarios)('情境 #%i：export → import 完全還原', async () => {
    const nTrips = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < nTrips; i++) await seedRandomTrip();
    // 隨機造訪國家
    const codes = ['JP', 'KR', 'VN', 'TH', 'US', 'FR'];
    const nVisited = Math.floor(rand() * codes.length);
    for (let i = 0; i < nVisited; i++) {
      const v: VisitedCountry = {
        code: codes[i],
        name: codes[i],
        visitedAt: new Date().toISOString(),
      };
      await db.visitedCountries.put(v);
    }

    const before = await exportSnapshot();

    // 清空再匯入快照
    await importSnapshot(before);
    const after = await exportSnapshot();

    // 兩份快照的資料（排除時間戳）應完全一致
    const strip = (s: typeof before) => ({
      trips: [...s.trips].sort((a, b) => a.id.localeCompare(b.id)),
      expenses: [...s.expenses].sort((a, b) => a.id.localeCompare(b.id)),
      packingItems: [...s.packingItems].sort((a, b) => a.id.localeCompare(b.id)),
      souvenirs: [...s.souvenirs].sort((a, b) => a.id.localeCompare(b.id)),
      transports: [...s.transports].sort((a, b) => a.id.localeCompare(b.id)),
      visitedCountries: [...s.visitedCountries].sort((a, b) => a.code.localeCompare(b.code)),
    });
    expect(strip(after)).toEqual(strip(before));
  });

  test.each(scenarios.slice(0, 60))('情境 #%i：刪除旅程會連帶清除附屬資料', async () => {
    const tripId = await seedRandomTrip();
    // 確認附屬資料確實存在
    const packingBefore = await db.packingItems.where('tripId').equals(tripId).count();
    expect(packingBefore).toBeGreaterThan(0);

    await deleteTrip(tripId);

    expect(await db.trips.get(tripId)).toBeUndefined();
    expect(await db.expenses.where('tripId').equals(tripId).count()).toBe(0);
    expect(await db.packingItems.where('tripId').equals(tripId).count()).toBe(0);
    expect(await db.souvenirs.where('tripId').equals(tripId).count()).toBe(0);
    expect(await db.transports.where('tripId').equals(tripId).count()).toBe(0);
  });
});
