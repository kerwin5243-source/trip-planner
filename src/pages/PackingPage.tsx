import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { defaultPackingItems, uuid, type PackingItem } from '../models/types';

const itemEmojis = ['🎒', '👕', '👟', '🧦', '🕶️', '🧴', '📱', '💻', '🎧', '📖', '🍫', '🧸'];

/* ===== 自訂/編輯項目表單 ===== */
function ItemForm({
  item,
  onDone,
  onDelete,
}: {
  item: PackingItem | null; // null = 新增
  onDone: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [icon, setIcon] = useState(item?.icon ?? itemEmojis[0]);
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const { id: tripId } = useParams<{ id: string }>();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    if (item) {
      await db.packingItems.update(item.id, { name: name.trim(), icon, quantity });
    } else {
      await db.packingItems.add({
        id: uuid(),
        tripId: tripId!,
        name: name.trim(),
        icon,
        isPacked: false,
        quantity,
        isCustom: true,
      });
    }
    onDone();
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          物品名稱
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：泳衣"
            autoFocus
          />
        </label>
        <label>
          數量
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      <div className="emoji-picker">
        {(item && !itemEmojis.includes(item.icon) ? [item.icon, ...itemEmojis] : itemEmojis).map(
          (em) => (
            <button
              key={em}
              type="button"
              className={`emoji-option ${em === icon ? 'selected' : ''}`}
              onClick={() => setIcon(em)}
            >
              {em}
            </button>
          ),
        )}
      </div>

      <div className="form-row">
        <button type="button" className="btn-secondary" onClick={onDone}>
          取消
        </button>
        <button type="submit" className="btn-primary">
          儲存
        </button>
      </div>
      {item && onDelete && (
        <button type="button" className="btn-danger" onClick={onDelete}>
          刪除這個項目
        </button>
      )}
    </form>
  );
}

/* ===== 主頁面 ===== */
export default function PackingPage() {
  const { id } = useParams<{ id: string }>();
  // trip：undefined = 載入中，null = 找不到
  const trip = useLiveQuery(async () => (id ? ((await db.trips.get(id)) ?? null) : null), [id]);
  const items = useLiveQuery(
    () => (id ? db.packingItems.where('tripId').equals(id).toArray() : []),
    [id],
  );

  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState<'new' | string | null>(null);

  // 第一次進入時鋪上預設 12 項（固定 id + bulkPut，StrictMode 重跑也安全；
  // 之後使用者刪掉預設項目不會被重新加回，因為只在完全沒有項目時才鋪）
  useEffect(() => {
    if (!id || !trip) return;
    db.packingItems
      .where('tripId')
      .equals(id)
      .count()
      .then((n) => {
        if (n === 0) return db.packingItems.bulkPut(defaultPackingItems(id));
      });
  }, [id, trip]);

  if (trip === undefined || !items) return null;
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

  // 預設項目照 FRP 原始順序排，自訂項目排在後面
  const defaultOrder = defaultPackingItems(trip.id).map((d) => d.id);
  const rank = (item: PackingItem) => {
    const i = defaultOrder.indexOf(item.id);
    return i === -1 ? defaultOrder.length : i;
  };
  const sorted = [...items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const packedCount = items.filter((i) => i.isPacked).length;
  const editingItem = editing && editing !== 'new' ? items.find((i) => i.id === editing) : null;

  async function handleTileClick(item: PackingItem) {
    if (editMode) {
      setEditing(item.id);
    } else {
      await db.packingItems.update(item.id, { isPacked: !item.isPacked });
    }
  }

  async function handleDelete() {
    if (!editingItem) return;
    if (!window.confirm(`確定要刪除「${editingItem.name}」嗎？`)) return;
    await db.packingItems.delete(editingItem.id);
    setEditing(null);
  }

  async function handleResetAll() {
    if (!window.confirm('要把所有項目改回「未備妥」嗎？')) return;
    await db.packingItems
      .where('tripId')
      .equals(id!)
      .modify({ isPacked: false });
  }

  return (
    <div className="page">
      <header className="app-header">
        <Link to={`/trip/${trip.id}`} className="back-btn" aria-label="返回">
          ‹
        </Link>
        <h1>{trip.title} — 行李清單</h1>
        <button
          type="button"
          className={`edit-toggle ${editMode ? 'active' : ''}`}
          onClick={() => {
            setEditMode(!editMode);
            setEditing(null);
          }}
        >
          {editMode ? '完成' : '編輯'}
        </button>
      </header>

      {editing !== null ? (
        <ItemForm
          item={editingItem ?? null}
          onDone={() => setEditing(null)}
          onDelete={handleDelete}
        />
      ) : (
        <>
          <div className="summary-card">
            <h2>準備進度</h2>
            <div className="progress-row">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: items.length ? `${(packedCount / items.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="progress-text">
                {packedCount}/{items.length}
              </span>
            </div>
            {packedCount > 0 && (
              <button type="button" className="text-btn" onClick={handleResetAll}>
                全部改回未備妥
              </button>
            )}
          </div>

          {editMode && <p className="hint">點一下項目即可編輯名稱、圖示、數量或刪除</p>}

          <div className="packing-grid">
            {sorted.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`packing-tile ${item.isPacked && !editMode ? 'packed' : ''} ${editMode ? 'editing' : ''}`}
                onClick={() => handleTileClick(item)}
              >
                <span className="packing-icon">{item.icon}</span>
                <span className="packing-name">
                  {item.name}
                  {item.quantity > 1 && ` ×${item.quantity}`}
                </span>
                {item.isPacked && !editMode && <span className="packing-check">✓</span>}
                {editMode && <span className="packing-check edit">✏️</span>}
              </button>
            ))}
            <button type="button" className="packing-tile add" onClick={() => setEditing('new')}>
              <span className="packing-icon">＋</span>
              <span className="packing-name">自訂項目</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
