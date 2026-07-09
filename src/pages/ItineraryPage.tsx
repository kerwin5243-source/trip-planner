import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import PlaceSearch from '../components/PlaceSearch';
import { db, saveTrip } from '../db/db';
import { fetchDailyWeather, weatherMeta, type DayWeather } from '../lib/geo';
import { toast } from '../lib/toast';
import {
  addMinutes,
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
  lat: undefined as number | undefined,
  lon: undefined as number | undefined,
};

type Draft = typeof emptyDraft;

function ItemForm({
  initial,
  dayLabels,
  initialDayIdx,
  onSave,
  onCancel,
}: {
  initial: Draft;
  dayLabels: string[]; // 供跨天搬移的日期選單
  initialDayIdx: number;
  onSave: (draft: Draft, targetDayIdx: number) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [dayIdx, setDayIdx] = useState(initialDayIdx);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    onSave({ ...draft, title: draft.title.trim() }, dayIdx);
  }

  return (
    <form className="form item-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          日期
          <select value={dayIdx} onChange={(e) => setDayIdx(Number(e.target.value))}>
            {dayLabels.map((label, i) => (
              <option key={i} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          抵達時間
          <input
            type="time"
            value={draft.arrivalTime}
            onChange={(e) => set('arrivalTime', e.target.value)}
          />
        </label>
      </div>

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
          地點搜尋（自動帶入地址與座標）
          <PlaceSearch
            placeholder="例如：清水寺"
            onSelect={(p) =>
              setDraft((d) => ({ ...d, address: p.name, lat: p.lat, lon: p.lon }))
            }
          />
        </label>
        <label>
          地址
          {draft.lat !== undefined && (
            <span className="hint" style={{ fontWeight: 400 }}>
              📍 已定位，儲存後行程卡會出現「導航」按鈕{' '}
              <button
                type="button"
                className="text-btn"
                onClick={() => setDraft((d) => ({ ...d, lat: undefined, lon: undefined }))}
              >
                移除座標
              </button>
            </span>
          )}
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
  // trip：undefined = 載入中，null = 找不到
  const trip = useLiveQuery(async () => (id ? ((await db.trips.get(id)) ?? null) : null), [id]);
  const [dayIndex, setDayIndex] = useState(0);
  const [editing, setEditing] = useState<'new' | string | null>(null); // 'new' | itemId | null
  const [weather, setWeather] = useState<Map<string, DayWeather>>(new Map());
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // 有設定目的地就抓天氣預報（超出 16 天預報範圍的日期不會有資料）
  const dest = trip?.destination;
  useEffect(() => {
    if (!trip || !dest) return;
    fetchDailyWeather(dest.lat, dest.lon, trip.startDate, trip.endDate)
      .then(setWeather)
      .catch(() => {});
  }, [dest, trip?.startDate, trip?.endDate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (trip === undefined) return null;
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

  const safeDayIndex = Math.min(dayIndex, trip.daySchedules.length - 1);
  const day = trip.daySchedules[safeDayIndex];
  // 顯示順序 = 陣列順序（可拖曳自訂）；新項目加入時會按時間插入
  const items = day.items;

  async function updateDayItems(t: Trip, newItems: ItineraryItem[]) {
    const daySchedules = t.daySchedules.map((d, i) =>
      i === safeDayIndex ? { ...d, items: newItems } : d,
    );
    await saveTrip({ ...t, daySchedules });
  }

  /** 依抵達時間找出插入位置 */
  function insertByTime(list: ItineraryItem[], item: ItineraryItem): ItineraryItem[] {
    const idx = list.findIndex((it) => it.arrivalTime > item.arrivalTime);
    const copy = [...list];
    copy.splice(idx === -1 ? copy.length : idx, 0, item);
    return copy;
  }

  async function handleSave(draft: Draft, targetDayIdx: number) {
    const t = trip!;
    const isNew = editing === 'new';
    const item: ItineraryItem = isNew
      ? { id: uuid(), ...draft }
      : { ...day.items.find((it) => it.id === editing)!, ...draft };

    const daySchedules = t.daySchedules.map((d, i) => {
      if (!isNew && i === safeDayIndex && i === targetDayIdx) {
        // 同天編輯：原地更新，保留使用者拖出來的順序
        return { ...d, items: d.items.map((it) => (it.id === item.id ? item : it)) };
      }
      const rest = d.items.filter((it) => it.id !== item.id);
      return i === targetDayIdx ? { ...d, items: insertByTime(rest, item) } : { ...d, items: rest };
    });
    await saveTrip({ ...t, daySchedules });
    setEditing(null);
    if (targetDayIdx !== safeDayIndex) {
      setDayIndex(targetDayIdx);
      toast(`已移到 Day ${targetDayIdx + 1}`);
    } else {
      toast(isNew ? '已加入行程' : '已儲存');
    }
  }

  async function handleReorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const copy = [...items];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    await updateDayItems(trip!, copy);
  }

  async function handleSortByTime() {
    await updateDayItems(
      trip!,
      [...items].sort((a, b) => a.arrivalTime.localeCompare(b.arrivalTime)),
    );
    toast('已依時間排序');
  }

  async function handleDelete(itemId: string) {
    if (!window.confirm('確定要刪除這個行程項目嗎？')) return;
    await updateDayItems(trip!, day.items.filter((it) => it.id !== itemId));
    toast('已刪除');
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
        {trip.daySchedules.map((d, i) => {
          const w = weather.get(d.date);
          return (
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
              {w && (
                <span className="day-weather" title={`${weatherMeta(w.code).label} ${w.tMin}–${w.tMax}°C`}>
                  {weatherMeta(w.code).emoji} {w.tMax}°
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {dest && weather.get(day.date) && (
        <p className="weather-line">
          📍 {dest.name.split(',')[0]} · {weatherMeta(weather.get(day.date)!.code).emoji}{' '}
          {weatherMeta(weather.get(day.date)!.code).label} {weather.get(day.date)!.tMin}–
          {weather.get(day.date)!.tMax}°C
        </p>
      )}

      {editing !== null ? (
        <ItemForm
          initial={editingItem ? { ...emptyDraft, ...editingItem } : emptyDraft}
          dayLabels={trip.daySchedules.map((d, i) => `Day ${i + 1} · ${formatDay(d.date)}`)}
          initialDayIdx={safeDayIndex}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <>
          {items.length === 0 && (
            <div className="empty-state">
              <p className="empty-emoji">🗓️</p>
              <p>Day {safeDayIndex + 1} 還沒有行程</p>
            </div>
          )}

          {items.length > 1 && (
            <div className="timeline-tools">
              <span className="hint">☰ 長按拖曳可調整順序</span>
              <button type="button" className="text-btn" onClick={handleSortByTime}>
                依時間排序
              </button>
            </div>
          )}

          <ul className="timeline">
            {items.map((item, idx) => (
              <li
                key={item.id}
                className={`timeline-row ${dragIdx === idx ? 'dragging' : ''}`}
                draggable
                onDragStart={(e) => {
                  setDragIdx(idx);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIdx !== null) handleReorder(dragIdx, idx);
                  setDragIdx(null);
                }}
                onDragEnd={() => setDragIdx(null)}
              >
                <div className="timeline-time">
                  <span className="mono timeline-start">{item.arrivalTime}</span>
                  <span className="mono timeline-end">
                    {addMinutes(item.arrivalTime, item.durationMinutes)}
                  </span>
                </div>
                <div className="timeline-node">
                  <span className={`timeline-dot ${item.isSplash ? 'splash' : ''}`} />
                  {idx < items.length - 1 && <span className="timeline-line" />}
                </div>
                <div className={`item-card timeline-card ${item.isSplash ? 'splash' : ''}`}>
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
                    {item.lat !== undefined && item.lon !== undefined && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        className="item-link"
                      >
                        🧭 導航
                      </a>
                    )}
                  </div>
                  <div className="item-actions">
                    <span className="drag-handle" aria-hidden="true">
                      ☰
                    </span>
                    <button type="button" onClick={() => setEditing(item.id)} aria-label="編輯">
                      ✏️
                    </button>
                    <button type="button" onClick={() => handleDelete(item.id)} aria-label="刪除">
                      🗑️
                    </button>
                  </div>
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
