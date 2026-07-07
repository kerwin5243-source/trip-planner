import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saveTrip } from '../db/db';
import {
  backgroundGradients,
  backgroundNames,
  createTrip,
  templateNames,
  todayISO,
  type BackgroundType,
  type TemplateType,
} from '../models/types';

const backgroundOptions = (Object.keys(backgroundNames) as BackgroundType[]).filter(
  (b) => b !== 'custom',
);

export default function NewTripPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [templateType, setTemplateType] = useState<TemplateType>('basic');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('ocean');
  const [error, setError] = useState('');

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
    const trip = createTrip({ title: title.trim(), startDate, endDate, templateType, backgroundType });
    await saveTrip(trip);
    navigate(`/trip/${trip.id}`, { replace: true });
  }

  return (
    <div className="page">
      <header className="app-header">
        <Link to="/" className="back-btn" aria-label="返回">
          ‹
        </Link>
        <h1>建立新旅程</h1>
      </header>

      <form className="form" onSubmit={handleSubmit}>
        <label>
          旅程名稱
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：四國遍路之旅"
            autoFocus
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
          建立旅程
        </button>
      </form>
    </div>
  );
}
