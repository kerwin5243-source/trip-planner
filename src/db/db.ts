/**
 * ============================
 * 本機資料庫 (IndexedDB via Dexie)
 * ============================
 * 本機優先 (local-first)：所有資料先存在裝置上，離線可完整使用。
 * 第二階段接上帳號後端後，以 updatedAt 為基準做同步。
 */
import Dexie, { type EntityTable } from 'dexie';
import type {
  ExpenseMember,
  ExpenseRecord,
  PackingItem,
  Souvenir,
  TransportEntry,
  Trip,
  VisitedCountry,
} from '../models/types';

/** 同步用的中繼資料（key-value） */
export interface MetaEntry {
  key: string;
  value: string;
}

const db = new Dexie('trip-planner') as Dexie & {
  trips: EntityTable<Trip, 'id'>;
  expenses: EntityTable<ExpenseRecord, 'id'>;
  expenseMembers: EntityTable<ExpenseMember, 'id'>;
  packingItems: EntityTable<PackingItem, 'id'>;
  souvenirs: EntityTable<Souvenir, 'id'>;
  transports: EntityTable<TransportEntry, 'id'>;
  visitedCountries: EntityTable<VisitedCountry, 'code'>;
  meta: EntityTable<MetaEntry, 'key'>;
};

db.version(1).stores({
  trips: 'id, startDate, endDate, createdAt',
  expenses: 'id, tripId, date',
  expenseMembers: 'id',
  packingItems: 'id, tripId',
  souvenirs: 'id, tripId',
});

// v2：新增交通路線表
db.version(2).stores({
  transports: 'id, tripId, date',
});

// v3：世界地圖迷霧 — 去過的國家
db.version(3).stores({
  visitedCountries: 'code',
});

// v4：同步中繼資料
db.version(4).stores({
  meta: 'key',
});

/* ===== 本機變更追蹤（供同步判斷用） ===== */

/** 會被同步的資料表 */
export const SYNC_TABLES = [
  'trips',
  'expenses',
  'expenseMembers',
  'packingItems',
  'souvenirs',
  'transports',
  'visitedCountries',
] as const;

/** 套用雲端資料時設為 true，避免把「下載」誤判成本機修改 */
let applyingRemote = false;

export async function withRemoteApply(fn: () => Promise<void>): Promise<void> {
  applyingRemote = true;
  try {
    await fn();
  } finally {
    applyingRemote = false;
  }
}

function markLocalChange() {
  if (applyingRemote) return;
  // hook 在交易內觸發，meta 表不一定在交易範圍內，所以跳出目前交易再寫
  Dexie.ignoreTransaction(() => {
    db.meta.put({ key: 'localChangedAt', value: new Date().toISOString() }).catch(() => {});
  });
}

for (const name of SYNC_TABLES) {
  const table = db.table(name);
  table.hook('creating', () => {
    markLocalChange();
  });
  table.hook('updating', () => {
    markLocalChange();
  });
  table.hook('deleting', () => {
    markLocalChange();
  });
}

export async function getMeta(key: string): Promise<string | null> {
  return (await db.meta.get(key))?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}

/** 更新旅行並自動蓋上 updatedAt */
export async function saveTrip(trip: Trip): Promise<void> {
  await db.trips.put({ ...trip, updatedAt: new Date().toISOString() });
}

/** 刪除旅行與其所有附屬資料 */
export async function deleteTrip(tripId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.trips, db.expenses, db.packingItems, db.souvenirs, db.transports],
    async () => {
      await db.trips.delete(tripId);
      await db.expenses.where('tripId').equals(tripId).delete();
      await db.packingItems.where('tripId').equals(tripId).delete();
      await db.souvenirs.where('tripId').equals(tripId).delete();
      await db.transports.where('tripId').equals(tripId).delete();
    },
  );
}

export { db };
