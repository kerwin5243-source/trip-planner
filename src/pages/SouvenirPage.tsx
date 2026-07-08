import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { toast } from '../lib/toast';
import { uuid, type Souvenir } from '../models/types';

const DEFAULT_REGION = '未分類';

function formatPrice(n: number): string {
  return n.toLocaleString('zh-TW', { maximumFractionDigits: 2 });
}

/* ===== 新增/編輯表單 ===== */
interface SouvenirDraft {
  name: string;
  description: string;
  expectedPrice: string;
  recipient: string;
  region: string;
}

function SouvenirForm({
  initial,
  regions,
  onSave,
  onCancel,
}: {
  initial: SouvenirDraft;
  regions: string[]; // 既有地區，做成快速選擇
  onSave: (draft: SouvenirDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<SouvenirDraft>(initial);
  const set = <K extends keyof SouvenirDraft>(key: K, value: SouvenirDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      recipient: draft.recipient.trim(),
      region: draft.region.trim() || DEFAULT_REGION,
    });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <label>
        名稱
        <input
          type="text"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="例如：一六本舗 霧の森大福"
          autoFocus
        />
      </label>

      <div className="form-row">
        <label>
          預期價格
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={draft.expectedPrice}
            onChange={(e) => set('expectedPrice', e.target.value)}
          />
        </label>
        <label>
          送給誰／代買
          <input
            type="text"
            value={draft.recipient}
            onChange={(e) => set('recipient', e.target.value)}
            placeholder="例如：媽媽"
          />
        </label>
      </div>

      <label>
        地區
        <input
          type="text"
          list="region-options"
          value={draft.region}
          onChange={(e) => set('region', e.target.value)}
          placeholder={`例如：高松（留空 = ${DEFAULT_REGION}）`}
        />
        <datalist id="region-options">
          {regions.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </label>

      <label>
        說明
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>

      <div className="form-row">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button type="submit" className="btn-primary">
          儲存
        </button>
      </div>
    </form>
  );
}

/* ===== 主頁面 ===== */
type Filter = 'all' | 'todo' | 'done';

export default function SouvenirPage() {
  const { id } = useParams<{ id: string }>();
  // trip：undefined = 載入中，null = 找不到
  const trip = useLiveQuery(async () => (id ? ((await db.trips.get(id)) ?? null) : null), [id]);
  const souvenirs = useLiveQuery(
    () => (id ? db.souvenirs.where('tripId').equals(id).toArray() : []),
    [id],
  );

  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<'new' | string | null>(null);

  if (trip === undefined || !souvenirs) return null;
  if (trip === null) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>找不到這趟旅程</p>
          <Link to="/">回首頁</Link>
        </div>
      </div>
    );
  }

  const purchasedCount = souvenirs.filter((s) => s.isPurchased).length;
  const totalPrice = souvenirs.reduce((sum, s) => sum + s.expectedPrice, 0);
  const regions = [...new Set(souvenirs.map((s) => s.region))].filter((r) => r !== DEFAULT_REGION);

  const filtered = souvenirs.filter((s) =>
    filter === 'all' ? true : filter === 'done' ? s.isPurchased : !s.isPurchased,
  );

  // 依地區分組（未分類排最後），組內未購買在前
  const byRegion = new Map<string, Souvenir[]>();
  for (const s of filtered) {
    const list = byRegion.get(s.region) ?? [];
    list.push(s);
    byRegion.set(s.region, list);
  }
  const regionGroups = [...byRegion.entries()].sort(([a], [b]) =>
    a === DEFAULT_REGION ? 1 : b === DEFAULT_REGION ? -1 : a.localeCompare(b),
  );
  for (const [, list] of regionGroups) {
    list.sort((a, b) => Number(a.isPurchased) - Number(b.isPurchased) || a.createdAt.localeCompare(b.createdAt));
  }

  const editingSouvenir =
    editing && editing !== 'new' ? souvenirs.find((s) => s.id === editing) : null;

  async function handleSave(draft: SouvenirDraft) {
    if (editing === 'new') {
      await db.souvenirs.add({
        id: uuid(),
        tripId: trip!.id,
        name: draft.name,
        description: draft.description || undefined,
        expectedPrice: Number(draft.expectedPrice) || 0,
        isPurchased: false,
        recipient: draft.recipient,
        region: draft.region,
        createdAt: new Date().toISOString(),
      });
    } else if (editingSouvenir) {
      await db.souvenirs.put({
        ...editingSouvenir,
        name: draft.name,
        description: draft.description || undefined,
        expectedPrice: Number(draft.expectedPrice) || 0,
        recipient: draft.recipient,
        region: draft.region,
      });
    }
    setEditing(null);
    toast('已儲存 🎁');
  }

  async function togglePurchased(s: Souvenir) {
    await db.souvenirs.update(s.id, { isPurchased: !s.isPurchased });
  }

  async function handleDelete(s: Souvenir) {
    if (!window.confirm(`確定要刪除「${s.name}」嗎？`)) return;
    await db.souvenirs.delete(s.id);
    toast('已刪除');
  }

  return (
    <div className="page">
      <header className="app-header">
        <Link to={`/trip/${trip.id}`} className="back-btn" aria-label="返回">
          ‹
        </Link>
        <h1>{trip.title} — 伴手禮</h1>
      </header>

      {editing !== null ? (
        <SouvenirForm
          initial={
            editingSouvenir
              ? {
                  name: editingSouvenir.name,
                  description: editingSouvenir.description ?? '',
                  expectedPrice: editingSouvenir.expectedPrice
                    ? String(editingSouvenir.expectedPrice)
                    : '',
                  recipient: editingSouvenir.recipient,
                  region: editingSouvenir.region === DEFAULT_REGION ? '' : editingSouvenir.region,
                }
              : { name: '', description: '', expectedPrice: '', recipient: '', region: '' }
          }
          regions={regions}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          <div className="summary-card">
            <h2>購買進度</h2>
            <div className="progress-row">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: souvenirs.length
                      ? `${(purchasedCount / souvenirs.length) * 100}%`
                      : '0%',
                  }}
                />
              </div>
              <span className="progress-text">
                {purchasedCount}/{souvenirs.length}
              </span>
            </div>
            {totalPrice > 0 && <p className="hint">預期總花費 {formatPrice(totalPrice)}</p>}
          </div>

          {souvenirs.length > 0 && (
            <div className="member-chips">
              {(
                [
                  ['all', '全部'],
                  ['todo', '還沒買'],
                  ['done', '已購買'],
                ] as Array<[Filter, string]>
              ).map(([f, label]) => (
                <button
                  key={f}
                  type="button"
                  className={`split-chip ${filter === f ? 'selected' : ''}`}
                  onClick={() => setFilter(f)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {souvenirs.length === 0 && (
            <div className="empty-state">
              <p className="empty-emoji">🎁</p>
              <p>還沒有伴手禮清單</p>
              <p className="hint">把想買的名產、要幫忙代購的東西都記下來吧！</p>
            </div>
          )}

          {regionGroups.map(([region, list]) => (
            <section key={region} className="trip-section">
              <h2>📌 {region}</h2>
              <ul className="item-list">
                {list.map((s) => (
                  <li key={s.id} className={`item-card ${s.isPurchased ? 'purchased' : ''}`}>
                    <button
                      type="button"
                      className={`souvenir-check ${s.isPurchased ? 'checked' : ''}`}
                      onClick={() => togglePurchased(s)}
                      aria-label={s.isPurchased ? '改為未購買' : '標記已購買'}
                    >
                      {s.isPurchased ? '✓' : ''}
                    </button>
                    <div className="item-body">
                      <div className="item-title">{s.name}</div>
                      <div className="item-meta">
                        {s.recipient && `送 ${s.recipient} · `}
                        {s.expectedPrice > 0 && `預期 ${formatPrice(s.expectedPrice)}`}
                      </div>
                      {s.description && <div className="item-desc">{s.description}</div>}
                    </div>
                    <div className="item-actions">
                      <button type="button" onClick={() => setEditing(s.id)} aria-label="編輯">
                        ✏️
                      </button>
                      <button type="button" onClick={() => handleDelete(s)} aria-label="刪除">
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <button type="button" className="fab" onClick={() => setEditing('new')} aria-label="新增伴手禮">
            ＋
          </button>
        </>
      )}
    </div>
  );
}
