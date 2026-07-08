import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, deleteTrip } from '../db/db';
import { toast } from '../lib/toast';
import { backgroundGradients, totalDays } from '../models/types';

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // trip：undefined = 載入中，null = 找不到
  const trip = useLiveQuery(async () => (id ? ((await db.trips.get(id)) ?? null) : null), [id]);

  // 各模組即時統計，讓儀表板一眼看到進度
  const stats = useLiveQuery(async () => {
    if (!id) return null;
    const [expenseCount, packing, souvenirs, transportCount] = await Promise.all([
      db.expenses.where('tripId').equals(id).count(),
      db.packingItems.where('tripId').equals(id).toArray(),
      db.souvenirs.where('tripId').equals(id).toArray(),
      db.transports.where('tripId').equals(id).count(),
    ]);
    return {
      expenseCount,
      packedCount: packing.filter((p) => p.isPacked).length,
      packingTotal: packing.length,
      purchasedCount: souvenirs.filter((s) => s.isPurchased).length,
      souvenirTotal: souvenirs.length,
      transportCount,
    };
  }, [id]);

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

  const itemCount = trip.daySchedules.reduce((n, d) => n + d.items.length, 0);
  const itineraryTransportCount = trip.daySchedules.reduce(
    (n, d) => n + d.items.filter((it) => it.type === 'transport').length,
    0,
  );

  const modules = [
    {
      key: 'itinerary',
      name: '行程表',
      emoji: '🗓️',
      stat: itemCount > 0 ? `${itemCount} 個項目` : '開始安排',
    },
    {
      key: 'transportation',
      name: '交通路線',
      emoji: '🚆',
      stat:
        (stats?.transportCount ?? 0) + itineraryTransportCount > 0
          ? `${(stats?.transportCount ?? 0) + itineraryTransportCount} 段路線`
          : '尚未記錄',
    },
    {
      key: 'expenses',
      name: '記帳',
      emoji: '💰',
      stat: stats?.expenseCount ? `${stats.expenseCount} 筆開銷` : '尚未記帳',
    },
    {
      key: 'packing',
      name: '行李清單',
      emoji: '🎒',
      stat: stats?.packingTotal
        ? `已備妥 ${stats.packedCount}/${stats.packingTotal}`
        : '開始準備',
    },
    {
      key: 'souvenir',
      name: '伴手禮',
      emoji: '🎁',
      stat: stats?.souvenirTotal
        ? `已買 ${stats.purchasedCount}/${stats.souvenirTotal}`
        : '尚無清單',
    },
  ];

  async function handleDelete() {
    if (!window.confirm(`確定要刪除「${trip!.title}」嗎？此動作無法復原。`)) return;
    await deleteTrip(trip!.id);
    toast('旅程已刪除');
    navigate('/', { replace: true });
  }

  return (
    <div className="page">
      <div className="trip-banner" style={{ background: backgroundGradients[trip.backgroundType] }}>
        <Link to="/" className="back-btn on-banner" aria-label="返回">
          ‹
        </Link>
        <Link to={`/trip/${trip.id}/edit`} className="banner-edit" aria-label="編輯旅程">
          編輯
        </Link>
        <h1>{trip.title}</h1>
        <p className="mono">
          {trip.startDate.replaceAll('-', '.')} – {trip.endDate.replaceAll('-', '.')} ·{' '}
          {totalDays(trip)} 天 · {itemCount} 個行程
        </p>
        {trip.destination && (
          <span className="banner-destination">📍 {trip.destination.name.split(',')[0]}</span>
        )}
      </div>

      <div className="module-grid">
        {modules.map((m) => (
          <Link key={m.key} to={`/trip/${trip.id}/${m.key}`} className="module-tile">
            <span className="module-emoji">{m.emoji}</span>
            <span>{m.name}</span>
            <span className="module-stat mono">{m.stat}</span>
          </Link>
        ))}
      </div>

      <button type="button" className="btn-danger" onClick={handleDelete}>
        刪除這趟旅程
      </button>
    </div>
  );
}
