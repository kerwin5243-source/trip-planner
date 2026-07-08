import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import { db } from '../db/db';
import { backgroundGradients, todayISO, totalDays, type Trip } from '../models/types';

/** 計算距離某日期還有幾天（負數代表已過去） */
function daysUntil(dateISO: string): number {
  const ms =
    new Date(`${dateISO}T00:00:00`).getTime() - new Date(`${todayISO()}T00:00:00`).getTime();
  return Math.round(ms / 86400000);
}

function formatRange(trip: Trip): string {
  return `${trip.startDate.replaceAll('-', '.')} – ${trip.endDate.replaceAll('-', '.')}`;
}

function TripCard({ trip }: { trip: Trip }) {
  const today = todayISO();
  let badge: string;
  if (trip.startDate > today) {
    badge = `D-${daysUntil(trip.startDate)}`;
  } else if (trip.endDate < today) {
    badge = `${-daysUntil(trip.endDate)} 天前`;
  } else {
    badge = '進行中 ✈️';
  }
  return (
    <Link
      to={`/trip/${trip.id}`}
      className="trip-card"
      style={{ background: backgroundGradients[trip.backgroundType] }}
    >
      <span className="trip-card-badge">{badge}</span>
      <h3>{trip.title}</h3>
      <p className="mono">
        {formatRange(trip)} · {totalDays(trip)} 天
      </p>
    </Link>
  );
}

function Section({ title, trips }: { title: string; trips: Trip[] }) {
  if (trips.length === 0) return null;
  return (
    <section className="trip-section">
      <h2>{title}</h2>
      {trips.map((t) => (
        <TripCard key={t.id} trip={t} />
      ))}
    </section>
  );
}

export default function HomePage() {
  const trips = useLiveQuery(() => db.trips.orderBy('startDate').toArray(), []);
  const visitedCount = useLiveQuery(() => db.visitedCountries.count(), []);
  if (!trips) return null;

  const today = todayISO();
  const ongoing = trips.filter((t) => t.startDate <= today && t.endDate >= today);
  const upcoming = trips.filter((t) => t.startDate > today);
  const past = trips.filter((t) => t.endDate < today).reverse();
  const nextTrip = upcoming[0];

  return (
    <div className="page with-nav">
      <header className="hero">
        <p className="hero-eyebrow">TRIP PLANNER</p>
        <h1>我的旅程</h1>
        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-num mono">{trips.length}</span>
            <span className="hero-stat-label">趟旅程</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num mono">{visitedCount ?? 0}</span>
            <span className="hero-stat-label">個國家</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-num mono">
              {nextTrip ? `D-${daysUntil(nextTrip.startDate)}` : '—'}
            </span>
            <span className="hero-stat-label">下次出發</span>
          </div>
        </div>
      </header>

      {trips.length === 0 && (
        <div className="empty-state">
          <p className="empty-emoji">🧳</p>
          <p>還沒有任何旅程</p>
          <p className="hint">點右下角的 + 建立第一趟旅行吧！</p>
        </div>
      )}

      <Section title="進行中" trips={ongoing} />
      <Section title="即將出發" trips={upcoming} />
      <Section title="過去回顧" trips={past} />

      <Link to="/new" className="fab" aria-label="新增旅程">
        ＋
      </Link>

      <BottomNav />
    </div>
  );
}
