/**
 * ============================
 * 同步邏輯
 * ============================
 * 策略（第二階段刻意保持簡單）：整份資料快照上傳/下載，最後寫入者勝。
 * - localChangedAt（本機時鐘）> lastLocalSyncAt ⇒ 本機有新修改
 * - 雲端 updatedAt ≠ 上次記下的 lastServerUpdatedAt ⇒ 雲端有新版本（比對身分而非先後，避免兩邊時鐘不一致）
 * - 兩者都成立 ⇒ 衝突，讓使用者選要保留哪邊
 */
import { db, getMeta, setMeta, withRemoteApply } from '../db/db';
import type {
  ExpenseMember,
  ExpenseRecord,
  PackingItem,
  Souvenir,
  TransportEntry,
  Trip,
  VisitedCountry,
} from '../models/types';
import { getAuth, getSync, putSync } from './api';

export interface Snapshot {
  version: 1;
  exportedAt: string;
  trips: Trip[];
  expenses: ExpenseRecord[];
  expenseMembers: ExpenseMember[];
  packingItems: PackingItem[];
  souvenirs: Souvenir[];
  transports: TransportEntry[];
  visitedCountries: VisitedCountry[];
}

export async function exportSnapshot(): Promise<Snapshot> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    trips: await db.trips.toArray(),
    expenses: await db.expenses.toArray(),
    expenseMembers: await db.expenseMembers.toArray(),
    packingItems: await db.packingItems.toArray(),
    souvenirs: await db.souvenirs.toArray(),
    transports: await db.transports.toArray(),
    visitedCountries: await db.visitedCountries.toArray(),
  };
}

export async function importSnapshot(s: Snapshot): Promise<void> {
  await withRemoteApply(async () => {
    await db.transaction(
      'rw',
      [
        db.trips,
        db.expenses,
        db.expenseMembers,
        db.packingItems,
        db.souvenirs,
        db.transports,
        db.visitedCountries,
      ],
      async () => {
        await db.trips.clear();
        await db.expenses.clear();
        await db.expenseMembers.clear();
        await db.packingItems.clear();
        await db.souvenirs.clear();
        await db.transports.clear();
        await db.visitedCountries.clear();
        await db.trips.bulkPut(s.trips ?? []);
        await db.expenses.bulkPut(s.expenses ?? []);
        await db.expenseMembers.bulkPut(s.expenseMembers ?? []);
        await db.packingItems.bulkPut(s.packingItems ?? []);
        await db.souvenirs.bulkPut(s.souvenirs ?? []);
        await db.transports.bulkPut(s.transports ?? []);
        await db.visitedCountries.bulkPut(s.visitedCountries ?? []);
      },
    );
  });
}

export type SyncStatus = 'pushed' | 'pulled' | 'in-sync' | 'conflict' | 'error' | 'not-logged-in';

export interface SyncResult {
  status: SyncStatus;
  message: string;
}

async function markSynced(serverUpdatedAt: string): Promise<void> {
  await setMeta('lastLocalSyncAt', new Date().toISOString());
  await setMeta('lastServerUpdatedAt', serverUpdatedAt);
  await setMeta('lastSyncDisplay', new Date().toISOString());
}

/**
 * 執行一次同步。
 * @param resolve 衝突時的決定：'local' = 以本機為準上傳，'remote' = 以雲端為準下載
 */
export async function syncNow(resolve?: 'local' | 'remote'): Promise<SyncResult> {
  const auth = getAuth();
  if (!auth) return { status: 'not-logged-in', message: '尚未登入' };

  try {
    const localChangedAt = await getMeta('localChangedAt');
    const lastLocalSyncAt = await getMeta('lastLocalSyncAt');
    const lastServerUpdatedAt = await getMeta('lastServerUpdatedAt');

    const remote = await getSync(auth);
    // 這台裝置從未同步過、但本機已有資料 → 也要視為「本機有修改」，
    // 避免第一次同步時被雲端資料靜默蓋掉
    const neverSynced = !lastLocalSyncAt;
    const hasLocalData =
      (await db.trips.count()) > 0 || (await db.visitedCountries.count()) > 0;
    const localDirty =
      (!!localChangedAt && (!lastLocalSyncAt || localChangedAt > lastLocalSyncAt)) ||
      (neverSynced && hasLocalData);
    const remoteNewer = !!remote.updatedAt && remote.updatedAt !== lastServerUpdatedAt;

    const push = async (): Promise<SyncResult> => {
      const res = await putSync(auth, await exportSnapshot());
      await markSynced(res.updatedAt);
      return { status: 'pushed', message: '已上傳本機資料到雲端' };
    };
    const pull = async (): Promise<SyncResult> => {
      await importSnapshot(remote.data as Snapshot);
      await markSynced(remote.updatedAt!);
      return { status: 'pulled', message: '已下載雲端資料到這台裝置' };
    };

    if (resolve === 'local') return push();
    if (resolve === 'remote') return remote.data ? pull() : push();
    if (!remote.data) return push(); // 雲端還沒有資料 → 直接上傳
    if (localDirty && remoteNewer) {
      return {
        status: 'conflict',
        message: '本機和雲端都有新修改，請選擇要保留哪一邊',
      };
    }
    if (localDirty) return push();
    if (remoteNewer) return pull();
    return { status: 'in-sync', message: '已是最新狀態' };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : '同步失敗' };
  }
}

/** App 啟動時的安靜同步：有衝突或錯誤就跳過，不打擾使用者 */
export async function silentSync(): Promise<void> {
  const auth = getAuth();
  if (!auth) return;
  await syncNow();
}
