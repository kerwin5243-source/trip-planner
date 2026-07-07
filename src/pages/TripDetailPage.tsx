import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, deleteTrip } from '../db/db';
import { backgroundGradients, totalDays } from '../models/types';

interface ModuleDef {
  key: string;
  name: string;
  emoji: string;
  ready: boolean;
}

/** 功能模組清單 — ready=false 的會顯示「即將推出」，之後一個一個補上 */
const modules: ModuleDef[] = [
  { key: 'itinerary', name: '行程表', emoji: '🗓️', ready: true },
  { key: 'transportation', name: '交通路線', emoji: '🚆', ready: false },
  { key: 'expenses', name: '記帳', emoji: '💰', ready: false },
  { key: 'packing', name: '行李清單', emoji: '🎒', ready: false },
  { key: 'souvenir', name: '伴手禮', emoji: '🎁', ready: false },
];

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const trip = useLiveQuery(() => (id ? db.trips.get(id) : undefined), [id]);

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

  const itemCount = trip.daySchedules.reduce((n, d) => n + d.items.length, 0);

  async function handleDelete() {
    if (!window.confirm(`確定要刪除「${trip!.title}」嗎？此動作無法復原。`)) return;
    await deleteTrip(trip!.id);
    navigate('/', { replace: true });
  }

  return (
    <div className="page">
      <div className="trip-banner" style={{ background: backgroundGradients[trip.backgroundType] }}>
        <Link to="/" className="back-btn on-banner" aria-label="返回">
          ‹
        </Link>
        <h1>{trip.title}</h1>
        <p>
          {trip.startDate.replaceAll('-', '/')} ～ {trip.endDate.replaceAll('-', '/')} ·{' '}
          {totalDays(trip)} 天 · {itemCount} 個行程
        </p>
      </div>

      <div className="module-grid">
        {modules.map((m) =>
          m.ready ? (
            <Link key={m.key} to={`/trip/${trip.id}/${m.key}`} className="module-tile">
              <span className="module-emoji">{m.emoji}</span>
              <span>{m.name}</span>
            </Link>
          ) : (
            <div key={m.key} className="module-tile disabled">
              <span className="module-emoji">{m.emoji}</span>
              <span>{m.name}</span>
              <span className="coming-soon">即將推出</span>
            </div>
          ),
        )}
      </div>

      <button type="button" className="btn-danger" onClick={handleDelete}>
        刪除這趟旅程
      </button>
    </div>
  );
}
