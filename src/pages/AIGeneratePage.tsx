import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saveTrip } from '../db/db';
import {
  buildPrompt,
  generateItinerary,
  getStoredApiKey,
  parseAIItinerary,
  storeApiKey,
  type AIItinerary,
  type AIParams,
} from '../lib/ai';
import { toast } from '../lib/toast';
import { createTrip, todayISO, uuid, type ItineraryItem } from '../models/types';

export default function AIGeneratePage() {
  const navigate = useNavigate();
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [preferences, setPreferences] = useState('');
  const [apiKey, setApiKey] = useState(getStoredApiKey());
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<AIItinerary | null>(null);

  function validParams(): AIParams | null {
    if (!destination.trim()) {
      setError('請輸入目的地');
      return null;
    }
    if (endDate < startDate) {
      setError('結束日期不能早於開始日期');
      return null;
    }
    return { destination: destination.trim(), startDate, endDate, preferences };
  }

  async function handleGenerate(e: FormEvent) {
    e.preventDefault();
    setError('');
    const params = validParams();
    if (!params) return;
    if (!apiKey.trim()) {
      setError('請輸入 Anthropic API key，或改用下方的「複製提示詞」模式');
      return;
    }
    setBusy(true);
    try {
      storeApiKey(apiKey.trim());
      const result = await generateItinerary(apiKey.trim(), params);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 生成失敗，請稍後再試');
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyPrompt() {
    setError('');
    const params = validParams();
    if (!params) return;
    await navigator.clipboard.writeText(buildPrompt(params));
    toast('提示詞已複製，貼到任何 AI 吧');
  }

  function handleImport() {
    setError('');
    if (!validParams()) return;
    try {
      setPreview(parseAIItinerary(pasted));
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失敗');
    }
  }

  async function handleApply() {
    if (!preview) return;
    const trip = createTrip({
      title: preview.title,
      startDate,
      endDate,
      templateType: 'custom',
    });
    // AI 的 days 對到旅程日期；多出來的天數捨棄、不足的留空
    const daySchedules = trip.daySchedules.map((d, i) => ({
      ...d,
      items: (preview.days[i]?.items ?? []).map(
        (it): ItineraryItem => ({
          id: uuid(),
          arrivalTime: it.arrivalTime,
          title: it.title,
          type: it.type,
          durationMinutes: it.durationMinutes,
          description: it.description,
          precautions: '',
          guideInfo: '',
          reservationNo: '',
          address: '',
          mapCode: '',
          url: '',
          isSplash: false,
        }),
      ),
    }));
    await saveTrip({ ...trip, daySchedules });
    toast('AI 行程建立完成 ✨');
    navigate(`/trip/${trip.id}`, { replace: true });
  }

  const itemCount = preview?.days.reduce((n, d) => n + d.items.length, 0) ?? 0;

  return (
    <div className="page">
      <header className="app-header">
        <Link to="/new" className="back-btn" aria-label="返回">
          ‹
        </Link>
        <h1>AI 生成行程</h1>
      </header>

      {preview ? (
        <div className="form">
          <p className="hint" style={{ margin: 0 }}>
            預覽 — 確認沒問題就建立，之後都還能編輯
          </p>
          <h2 className="ai-preview-title">✨ {preview.title}</h2>
          {preview.days.map((d, i) => (
            <div key={i} className="ai-preview-day">
              <strong className="mono">Day {i + 1}</strong>
              <ul>
                {d.items.map((it, j) => (
                  <li key={j}>
                    <span className="mono">{it.arrivalTime}</span> {it.title}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="hint">共 {preview.days.length} 天、{itemCount} 個行程項目</p>
          <div className="form-row">
            <button type="button" className="btn-secondary" onClick={() => setPreview(null)}>
              重新生成
            </button>
            <button type="button" className="btn-primary" onClick={handleApply}>
              建立旅程
            </button>
          </div>
        </div>
      ) : (
        <form className="form" onSubmit={handleGenerate}>
          <label>
            目的地
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="例如：高松 + 直島"
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
            偏好與需求（選填）
            <textarea
              rows={2}
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="例如：帶長輩同行、步調放慢、想吃烏龍麵、避免爬坡"
            />
          </label>

          <label>
            Anthropic API key（存在這台裝置，不會上傳）
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'AI 規劃中，約需一分鐘…' : '✨ 直接生成'}
          </button>

          <details>
            <summary>沒有 API key？用複製貼上的方式</summary>
            <p className="hint">
              1. 填好上面的目的地和日期 → 按「複製提示詞」
              <br />
              2. 貼到任何 AI（Claude、ChatGPT⋯）
              <br />
              3. 把 AI 回覆的 JSON 貼回下面 → 按「匯入」
            </p>
            <button type="button" className="btn-secondary" onClick={handleCopyPrompt}>
              📋 複製提示詞
            </button>
            <label>
              貼上 AI 回傳的 JSON
              <textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} />
            </label>
            <button type="button" className="btn-secondary" onClick={handleImport}>
              匯入
            </button>
          </details>
        </form>
      )}
    </div>
  );
}
