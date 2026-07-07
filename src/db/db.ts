/**
 * ============================
 * 本機資料庫 (IndexedDB via Dexie)
 * ============================
 * 本機優先 (local-first)：所有資料先存在裝置上，離線可完整使用。
 * 第二階段接上帳號後端後，以 updatedAt 為基準做同步。
 */
import Dexie, { type EntityTable } from 'dexie';
import type { ExpenseMember, ExpenseRecord, PackingItem, Souvenir, Trip } from '../models/types';

const db = new Dexie('trip-planner') as Dexie & {
  trips: EntityTable<Trip, 'id'>;
  expenses: EntityTable<ExpenseRecord, 'id'>;
  expenseMembers: EntityTable<ExpenseMember, 'id'>;
  packingItems: EntityTable<PackingItem, 'id'>;
  souvenirs: EntityTable<Souvenir, 'id'>;
};

db.version(1).stores({
  trips: 'id, startDate, endDate, createdAt',
  expenses: 'id, tripId, date',
  expenseMembers: 'id',
  packingItems: 'id, tripId',
  souvenirs: 'id, tripId',
});

/** 更新旅行並自動蓋上 updatedAt */
export async function saveTrip(trip: Trip): Promise<void> {
  await db.trips.put({ ...trip, updatedAt: new Date().toISOString() });
}

/** 刪除旅行與其所有附屬資料 */
export async function deleteTrip(tripId: string): Promise<void> {
  await db.transaction('rw', [db.trips, db.expenses, db.packingItems, db.souvenirs], async () => {
    await db.trips.delete(tripId);
    await db.expenses.where('tripId').equals(tripId).delete();
    await db.packingItems.where('tripId').equals(tripId).delete();
    await db.souvenirs.where('tripId').equals(tripId).delete();
  });
}

export { db };
