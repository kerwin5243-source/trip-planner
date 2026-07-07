import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db, saveTrip } from '../db/db';
import {
  itineraryTypeMeta,
  uuid,
  type ItineraryItem,
  type ItineraryItemType,
  type Trip,
} from '../models/types';

const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

function formatDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdayNames[d.getDay()]})`;
}

const emptyDraft = {
  arrivalTime: '09:00',
  title: '',
  type: 'attraction' as ItineraryItemType,
  durationMinutes: 60,
  description: '',
  precautions: '',
  guideInfo: '',
  reservationNo: '',
  address: '',
  mapCode: '',
  url: '',
  isSplash: false,
};

type Draft = typeof emptyDraft;

function ItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Draft;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    onSave({ ...draft, title: draft.title.trim() });
  }

  return (
    <form className="form item-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          抵達時間
          <input
            type="time"
            value={draft.arrivalTime}
            onChange={(e) => set('arrivalTime', e.target.value)}
          />
        </label>
        <label>
          種類
          <select
            value={draft.type}
            onChange={(e) => set('type', e.target.value as ItineraryItemType)}
          >
            {(Object.keys(itineraryTypeMeta) as ItineraryItemType[]).map((t) => (
              <option key={t} value={t}>
                {itineraryTypeMeta[t].emoji} {itineraryTypeMeta[t].label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        標題
        <input
          type="text"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="例如：金刀比羅宮"
          autoFocus
        />
      </label>

      <div className="form-row">
        <label>
          停留時間（分鐘）
          <input
            type="number"
            min={0}
            step={5}
            value={draft.durationMinutes}
            onChange={(e) => set('durationMinutes', Number(e.target.value) || 0)}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.isSplash}
            onChange={(e) => set('isSplash', e.target.checked)}
          />
          ⭐ 重點行程
        </label>
      </div>

      <label>
        詳細描述
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>

      <details>
        <summary>更多欄位（地址、預約、注意事項…）</summary>
        <label>
          地址
          <input type="text" value={draft.address} onChange={(e) => set('address', e.target.value)} />
        </label>
        <label>
          網站連結
          <input type="url" value={draft.url} onChange={(e) => set('url', e.target.value)} />
        </label>
        <label>
          預約編號
          <input
            type="text"
            value={draft.reservationNo}
            onChange={(e) => set('reservationNo', e.target.value)}
          />
        </label>
        <label>
          MapCode
          <input type="text" value={draft.mapCode} onChange={(e) => set('mapCode', e.target.value)} />
        </label>
        <label>
          注意事項
          <textarea
            rows={2}
            value={draft.precautions}
            onChange={(e) => set('precautions', e.target.value)}
          />
        </label>
        <label>
          Guide 介紹
          <textarea
            rows={2}
            value={draft.guideInfo}
            onChange={(e) => set('guideInfo', e.target.value)}
          />
        </label>
      </details>

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

export default function ItineraryPage() {
  const { id } = useParams<{ id: string }>();
  const trip = useLiveQuery(() => (id ? db.trips.get(id) : undefined), [id]);
  const [dayIndex, setDayIndex] = useState(0);
  const [editing, setEditing] = useState<'new' | string | null>(null); // 'new' | itemId | null

  if (trip === undefined) return null;
  if (!trip) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>找不到這趟旅程</p>
          <Link to="/">回首頁</Link>
        </div>
      </div>
    );
  }

  const safeDayIndex = Math.min(dayIndex, trip.daySchedules.length - 1);
  const day = trip.daySchedules[safeDayIndex];
  const sortedItems = [...day.items].sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime));

  async function updateDayItems(t: Trip, items: ItineraryItem[]) {
    const daySchedules = t.daySchedules.map((d, i) => (i === safeDayIndex ? { ...d, items } : d));
    await saveTrip({ ...t, daySchedules });
  }

  async function handleSave(draft: Draft) {
    if (editing === 'new') {
      const item: ItineraryItem = { id: uuid(), ...draft };
      await updateDayItems(trip!, [...day.items, item]);
    } else if (editing) {
      await updateDayItems(
        trip!,
        day.items.map((it) => (it.id === editing ? { ...it, ...draft } : it)),
      );
    }
    setEditing(null);
  }

  async function handleDelete(itemId: string) {
    if (!window.confirm('確定要刪除這個行程項目嗎？')) return;
    await updateDayItems(trip!, day.items.filter((it) => it.id !== itemId));
  }

  const editingItem = editing && editing !== 'new' ? day.items.find((i) => i.id === editing) : null;

  return (
    <div className="page">
      <header className="app-header">
        <Link to={`/trip/${trip.id}`} className="back-btn" aria-label="返回">
          ‹
        </Link>
        <h1>{trip.title} — 行程表</h1>
      </header>

      <nav className="day-tabs">
        {trip.daySchedules.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className={`day-tab ${i === safeDayIndex ? 'active' : ''}`}
            onClick={() => {
              setDayIndex(i);
              setEditing(null);
            }}
          >
            <span className="day-num">Day {i + 1}</span>
            <span className="day-date">{formatDay(d.date)}</span>
          </button>
        ))}
      </nav>

      {editing !== null ? (
        <ItemForm
          initial={editingItem ? { ...emptyDraft, ...editingItem } : emptyDraft}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          {sortedItems.length === 0 && (
            <div className="empty-state">
              <p className="empty-emoji">🗓️</p>
              <p>Day {safeDayIndex + 1} 還沒有行程</p>
            </div>
          )}

          <ul className="item-list">
            {sortedItems.map((item) => (
              <li key={item.id} className={`item-card ${item.isSplash ? 'splash' : ''}`}>
                <div className="item-time">{item.arrivalTime}</div>
                <div className="item-body">
                  <div className="item-title">
                    {itineraryTypeMeta[item.type].emoji} {item.title}
                    {item.isSplash && ' ⭐'}
                  </div>
                  <div className="item-meta">
                    停留 {item.durationMinutes} 分鐘
                    {item.address && ` · ${item.address}`}
                  </div>
                  {item.description && <div className="item-desc">{item.description}</div>}
                  {item.url && (
                    <a href={item.url} target="_blank" rel="noreferrer" className="item-link">
                      🔗 網站
                    </a>
                  )}
                </div>
                <div className="item-actions">
                  <button type="button" onClick={() => setEditing(item.id)} aria-label="編輯">
                    ✏️
                  </button>
                  <button type="button" onClick={() => handleDelete(item.id)} aria-label="刪除">
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button type="button" className="fab" onClick={() => setEditing('new')} aria-label="新增行程項目">
            ＋
          </button>
        </>
      )}
    </div>
  );
}
