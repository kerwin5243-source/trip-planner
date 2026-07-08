import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/db';
import { toast } from '../lib/toast';
import {
  itineraryTypeMeta,
  todayISO,
  transportTypeMeta,
  uuid,
  type ItineraryItem,
  type TransportEntry,
  type TransportType,
} from '../models/types';

const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

function formatDateHeader(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdayNames[d.getDay()]})`;
}

/* ===== 新增/編輯表單 ===== */
interface TransportDraft {
  date: string;
  departTime: string;
  type: TransportType;
  from: string;
  to: string;
  note: string;
}

function TransportForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: TransportDraft;
  onSave: (draft: TransportDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<TransportDraft>(initial);
  const [error, setError] = useState('');
  const set = <K extends keyof TransportDraft>(key: K, value: TransportDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.from.trim() || !draft.to.trim()) {
      setError('請輸入出發地和目的地');
      return;
    }
    onSave({ ...draft, from: draft.from.trim(), to: draft.to.trim(), note: draft.note.trim() });
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          日期
          <input type="date" value={draft.date} onChange={(e) => set('date', e.target.value)} />
        </label>
        <label>
          出發時間（選填）
          <input
            type="time"
            value={draft.departTime}
            onChange={(e) => set('departTime', e.target.value)}
          />
        </label>
      </div>

      <label>
        交通方式
        <select value={draft.type} onChange={(e) => set('type', e.target.value as TransportType)}>
          {(Object.keys(transportTypeMeta) as TransportType[]).map((t) => (
            <option key={t} value={t}>
              {transportTypeMeta[t].emoji} {transportTypeMeta[t].label}
            </option>
          ))}
        </select>
      </label>

      <div className="form-row">
        <label>
          出發地
          <input
            type="text"
            value={draft.from}
            onChange={(e) => set('from', e.target.value)}
            placeholder="例如：東京車站"
            autoFocus
          />
        </label>
        <label>
          目的地
          <input
            type="text"
            value={draft.to}
            onChange={(e) => set('to', e.target.value)}
            placeholder="例如：大阪車站"
          />
        </label>
      </div>

      <label>
        備註（選填）
        <input
          type="text"
          value={draft.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="例如：新幹線自由席"
        />
      </label>

      {error && <p className="form-error">{error}</p>}

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
export default function TransportationPage() {
  const { id } = useParams<{ id: string }>();
  // trip：undefined = 載入中，null = 找不到
  const trip = useLiveQuery(async () => (id ? ((await db.trips.get(id)) ?? null) : null), [id]);
  const entries = useLiveQuery(
    () => (id ? db.transports.where('tripId').equals(id).toArray() : []),
    [id],
  );

  const [editing, setEditing] = useState<'new' | string | null>(null);

  if (trip === undefined || !entries) return null;
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

  // 行程表裡的交通項目也整合進來（唯讀，掛「行程表」標籤）
  const itineraryTransports = new Map<string, ItineraryItem[]>();
  for (const day of trip.daySchedules) {
    const transports = day.items.filter((it) => it.type === 'transport');
    if (transports.length > 0) {
      itineraryTransports.set(
        day.date,
        [...transports].sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime)),
      );
    }
  }

  // 手動記錄按日期分組、組內按時間排
  const byDate = new Map<string, TransportEntry[]>();
  for (const en of entries) {
    const list = byDate.get(en.date) ?? [];
    list.push(en);
    byDate.set(en.date, list);
  }
  for (const [, list] of byDate) {
    list.sort((a, b) => a.departTime.localeCompare(b.departTime) || a.createdAt.localeCompare(b.createdAt));
  }

  // 所有有內容的日期（兩種來源聯集），依日期排序
  const allDates = [...new Set([...byDate.keys(), ...itineraryTransports.keys()])].sort();

  const defaultDate =
    todayISO() >= trip.startDate && todayISO() <= trip.endDate ? todayISO() : trip.startDate;

  const editingEntry = editing && editing !== 'new' ? entries.find((e) => e.id === editing) : null;

  async function handleSave(draft: TransportDraft) {
    if (editing === 'new') {
      await db.transports.add({
        id: uuid(),
        tripId: trip!.id,
        createdAt: new Date().toISOString(),
        ...draft,
      });
    } else if (editingEntry) {
      await db.transports.put({ ...editingEntry, ...draft });
    }
    setEditing(null);
    toast('已儲存 🚆');
  }

  async function handleDelete(entry: TransportEntry) {
    if (!window.confirm(`確定要刪除「${entry.from} → ${entry.to}」嗎？`)) return;
    await db.transports.delete(entry.id);
    toast('已刪除');
  }

  return (
    <div className="page">
      <header className="app-header">
        <Link to={`/trip/${trip.id}`} className="back-btn" aria-label="返回">
          ‹
        </Link>
        <h1>{trip.title} — 交通路線</h1>
      </header>

      {editing !== null ? (
        <TransportForm
          initial={
            editingEntry
              ? {
                  date: editingEntry.date,
                  departTime: editingEntry.departTime,
                  type: editingEntry.type,
                  from: editingEntry.from,
                  to: editingEntry.to,
                  note: editingEntry.note,
                }
              : { date: defaultDate, departTime: '', type: 'train', from: '', to: '', note: '' }
          }
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          {allDates.length === 0 && (
            <div className="empty-state">
              <p className="empty-emoji">🚄</p>
              <p>尚無交通路線紀錄</p>
              <p className="hint">點右下角 + 新增，行程表裡的交通項目也會自動顯示在這裡</p>
            </div>
          )}

          {allDates.map((date) => (
            <section key={date} className="trip-section">
              <h2>{formatDateHeader(date)}</h2>
              <ul className="item-list">
                {(byDate.get(date) ?? []).map((en) => (
                  <li key={en.id} className="item-card">
                    <div className="expense-emoji">{transportTypeMeta[en.type].emoji}</div>
                    <div className="item-body">
                      <div className="item-title">
                        {en.from} <span className="route-arrow">→</span> {en.to}
                      </div>
                      <div className="item-meta">
                        {transportTypeMeta[en.type].label}
                        {en.departTime && ` · ${en.departTime} 出發`}
                      </div>
                      {en.note && <div className="item-desc">{en.note}</div>}
                    </div>
                    <div className="item-actions">
                      <button type="button" onClick={() => setEditing(en.id)} aria-label="編輯">
                        ✏️
                      </button>
                      <button type="button" onClick={() => handleDelete(en)} aria-label="刪除">
                        🗑️
                      </button>
                    </div>
                  </li>
                ))}
                {(itineraryTransports.get(date) ?? []).map((it) => (
                  <li key={it.id} className="item-card from-itinerary">
                    <div className="expense-emoji">{itineraryTypeMeta.transport.emoji}</div>
                    <div className="item-body">
                      <div className="item-title">{it.title}</div>
                      <div className="item-meta">
                        {it.arrivalTime} 抵達
                        {it.description && ` · ${it.description}`}
                      </div>
                    </div>
                    <Link to={`/trip/${trip.id}/itinerary`} className="itinerary-badge">
                      行程表
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <button type="button" className="fab" onClick={() => setEditing('new')} aria-label="新增交通路線">
            ＋
          </button>
        </>
      )}
    </div>
  );
}
