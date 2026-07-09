import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PlaceSearch from '../components/PlaceSearch';
import { saveTrip } from '../db/db';
import { db } from '../db/db';
import { toast } from '../lib/toast';
import {
  backgroundGradients,
  backgroundNames,
  createTrip,
  dateRange,
  templateNames,
  todayISO,
  type BackgroundType,
  type DaySchedule,
  type PlaceRef,
  type TemplateType,
} from '../models/types';

const backgroundOptions = (Object.keys(backgroundNames) as BackgroundType[]).filter(
  (b) => b !== 'custom',
);

/** 建立新旅程與編輯既有旅程共用的表單頁（有 :id 參數 = 編輯模式） */
export default function NewTripPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  // 編輯模式時載入旅程；undefined = 載入中，null = 找不到
  const existing = useLiveQuery(
    async () => (id ? ((await db.trips.get(id)) ?? null) : null),
    [id],
  );

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [templateType, setTemplateType] = useState<TemplateType>('basic');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('ocean');
  const [destination, setDestination] = useState<PlaceRef | undefined>(undefined);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  // 編輯模式：把既有資料帶進表單（只做一次）
  useEffect(() => {
    if (isEdit && existing && !loaded) {
      setTitle(existing.title);
      setStartDate(existing.startDate);
      setEndDate(existing.endDate);
      setTemplateType(existing.templateType);
      setBackgroundType(existing.backgroundType);
      setDestination(existing.destination);
      setLoaded(true);
    }
  }, [isEdit, existing, loaded]);

  if (isEdit && existing === undefined) return null;
  if (isEdit && existing === null) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>找不到這趟旅程</p>
          <Link to="/">回首頁</Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('請輸入旅程名稱');
      return;
    }
    if (endDate < startDate) {
      setError('結束日期不能早於開始日期');
      return;
    }

    if (isEdit && existing) {
      // 日期變動時：同日期的行程保留，新日期補空白；被移除的日期若有行程先確認
      const byDate = new Map(existing.daySchedules.map((d) => [d.date, d]));
      const newDates = dateRange(startDate, endDate);
      const dropped = existing.daySchedules.filter(
        (d) => !newDates.includes(d.date) && d.items.length > 0,
      );
      if (dropped.length > 0) {
        const total = dropped.reduce((n, d) => n + d.items.length, 0);
        if (
          !window.confirm(
            `新的日期範圍不包含 ${dropped.length} 天已排好的行程（共 ${total} 個項目），這些行程將被刪除。確定要繼續嗎？`,
          )
        )
          return;
      }
      const daySchedules: DaySchedule[] = newDates.map(
        (date) => byDate.get(date) ?? { date, items: [], highlightImages: [] },
      );
      await saveTrip({
        ...existing,
        title: title.trim(),
        startDate,
        endDate,
        templateType,
        backgroundType,
        destination,
        daySchedules,
      });
      toast('已儲存變更');
      navigate(`/trip/${existing.id}`, { replace: true });
    } else {
      const trip = createTrip({
        title: title.trim(),
        startDate,
        endDate,
        templateType,
        backgroundType,
      });
      await saveTrip({ ...trip, destination });
      toast('旅程建立完成 ✈️');
      navigate(`/trip/${trip.id}`, { replace: true });
    }
  }

  return (
    <div className="page">
      <header className="app-header">
        <Link to={isEdit ? `/trip/${id}` : '/'} className="back-btn" aria-label="返回">
          ‹
        </Link>
        <h1>{isEdit ? '編輯旅程' : '建立新旅程'}</h1>
      </header>

      {!isEdit && (
        <Link to="/ai-generate" className="ai-entry">
          ✨ 懶得排？讓 AI 生成整趟行程 ›
        </Link>
      )}

      <form className="form" onSubmit={handleSubmit}>
        <label>
          旅程名稱
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：四國遍路之旅"
            autoFocus={!isEdit}
          />
        </label>

        <div className="form-row">
          <label>
            開始日期
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label>
            結束日期
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>

        <label>
          模板
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value as TemplateType)}
          >
            {(Object.keys(templateNames) as TemplateType[]).map((t) => (
              <option key={t} value={t}>
                {templateNames[t]}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="bg-picker">
          <legend>目的地（選填，行程表會顯示當地天氣預報）</legend>
          {destination ? (
            <div className="member-chips" style={{ marginBottom: 0 }}>
              <button
                type="button"
                className="member-chip visited-chip"
                onClick={() => setDestination(undefined)}
                title="點一下移除"
              >
                📍 {destination.name.split(',')[0]} ✕
              </button>
            </div>
          ) : (
            <PlaceSearch placeholder="搜尋城市，例如：京都" onSelect={setDestination} />
          )}
        </fieldset>

        <fieldset className="bg-picker">
          <legend>背景主題</legend>
          <div className="bg-swatches">
            {backgroundOptions.map((bg) => (
              <button
                key={bg}
                type="button"
                className={`bg-swatch ${bg === backgroundType ? 'selected' : ''}`}
                style={{ background: backgroundGradients[bg] }}
                onClick={() => setBackgroundType(bg)}
                title={backgroundNames[bg]}
                aria-label={backgroundNames[bg]}
              />
            ))}
          </div>
          <p className="hint">{backgroundNames[backgroundType]}</p>
        </fieldset>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="btn-primary">
          {isEdit ? '儲存變更' : '建立旅程'}
        </button>
      </form>
    </div>
  );
}
