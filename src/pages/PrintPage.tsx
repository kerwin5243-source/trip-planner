import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db } from '../db/db';
import {
  addMinutes,
  expenseCategoryMeta,
  itineraryTypeMeta,
  totalDays,
  transportTypeMeta,
} from '../models/types';

const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];

function formatDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()} (${weekdayNames[d.getDay()]})`;
}

/** 整趟旅程的列印版面：用瀏覽器「列印 → 另存為 PDF」匯出 */
export default function PrintPage() {
  const { id } = useParams<{ id: string }>();
  const trip = useLiveQuery(async () => (id ? ((await db.trips.get(id)) ?? null) : null), [id]);
  const data = useLiveQuery(async () => {
    if (!id) return null;
    const [expenses, packing, souvenirs, transports] = await Promise.all([
      db.expenses.where('tripId').equals(id).toArray(),
      db.packingItems.where('tripId').equals(id).toArray(),
      db.souvenirs.where('tripId').equals(id).toArray(),
      db.transports.where('tripId').equals(id).toArray(),
    ]);
    return { expenses, packing, souvenirs, transports };
  }, [id]);

  if (trip === undefined || !data) return null;
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

  const totals = new Map<string, number>();
  for (const ex of data.expenses) {
    totals.set(ex.currency, (totals.get(ex.currency) ?? 0) + ex.amount);
  }
  const transportsByDate = [...data.transports].sort(
    (a, b) => a.date.localeCompare(b.date) || a.departTime.localeCompare(b.departTime),
  );

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <Link to={`/trip/${trip.id}`} className="btn-secondary print-back">
          ‹ 返回
        </Link>
        <button type="button" className="btn-primary" onClick={() => window.print()}>
          🖨️ 列印 / 另存為 PDF
        </button>
      </div>

      <header className="print-cover">
        <p className="print-eyebrow">TRIP PLANNER</p>
        <h1>{trip.title}</h1>
        <p className="mono">
          {trip.startDate.replaceAll('-', '.')} – {trip.endDate.replaceAll('-', '.')} ·{' '}
          {totalDays(trip)} 天
          {trip.destination && ` · 📍 ${trip.destination.name.split(',')[0]}`}
        </p>
      </header>

      <section>
        <h2>🗓️ 每日行程</h2>
        {trip.daySchedules.map((d, i) => (
          <div key={d.date} className="print-day">
            <h3>
              Day {i + 1} <span className="mono">{formatDay(d.date)}</span>
            </h3>
            {d.items.length === 0 ? (
              <p className="print-empty">（尚未安排）</p>
            ) : (
              <table>
                <tbody>
                  {d.items.map((it) => (
                    <tr key={it.id}>
                      <td className="mono print-time">
                        {it.arrivalTime}–{addMinutes(it.arrivalTime, it.durationMinutes)}
                      </td>
                      <td>
                        <strong>
                          {itineraryTypeMeta[it.type].emoji} {it.title}
                          {it.isSplash && ' ⭐'}
                        </strong>
                        {it.address && <div className="print-sub">{it.address}</div>}
                        {it.description && <div className="print-sub">{it.description}</div>}
                        {it.precautions && <div className="print-sub">⚠️ {it.precautions}</div>}
                        {it.reservationNo && (
                          <div className="print-sub mono">預約：{it.reservationNo}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </section>

      {transportsByDate.length > 0 && (
        <section>
          <h2>🚆 交通路線</h2>
          <table>
            <tbody>
              {transportsByDate.map((t) => (
                <tr key={t.id}>
                  <td className="mono print-time">
                    {t.date.slice(5).replace('-', '/')} {t.departTime}
                  </td>
                  <td>
                    {transportTypeMeta[t.type].emoji} {t.from} → {t.to}
                    {t.note && <div className="print-sub">{t.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.packing.length > 0 && (
        <section>
          <h2>🎒 行李清單</h2>
          <p className="print-checklist">
            {data.packing.map((p) => (
              <span key={p.id} className="print-check-item">
                {p.isPacked ? '☑' : '☐'} {p.name}
                {p.quantity > 1 && ` ×${p.quantity}`}
              </span>
            ))}
          </p>
        </section>
      )}

      {data.souvenirs.length > 0 && (
        <section>
          <h2>🎁 伴手禮</h2>
          <table>
            <tbody>
              {data.souvenirs.map((s) => (
                <tr key={s.id}>
                  <td className="print-time">{s.isPurchased ? '☑' : '☐'}</td>
                  <td>
                    {s.name}
                    {s.recipient && `（送 ${s.recipient}）`}
                    {s.expectedPrice > 0 && ` · 預期 ${s.expectedPrice.toLocaleString()}`}
                    {s.region !== '未分類' && ` · ${s.region}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {data.expenses.length > 0 && (
        <section>
          <h2>💰 開銷摘要</h2>
          <p>
            共 {data.expenses.length} 筆：
            {[...totals]
              .map(([c, t]) => `${t.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} ${c}`)
              .join('、')}
          </p>
          <table>
            <tbody>
              {[...data.expenses]
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((ex) => (
                  <tr key={ex.id}>
                    <td className="mono print-time">{ex.date.slice(5).replace('-', '/')}</td>
                    <td>
                      {expenseCategoryMeta[ex.category].emoji}{' '}
                      {ex.description || expenseCategoryMeta[ex.category].label}
                    </td>
                    <td className="mono print-amount">
                      {ex.amount.toLocaleString('zh-TW', { maximumFractionDigits: 2 })} {ex.currency}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="print-footer mono">Generated by Trip Planner</footer>
    </div>
  );
}
