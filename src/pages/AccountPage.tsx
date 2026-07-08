import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import BottomNav from '../components/BottomNav';
import { db } from '../db/db';
import { clearAuth, getAuth, login, register, setAuth, type AuthState } from '../lib/api';
import { syncNow, type SyncResult } from '../lib/sync';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
}

/* ===== 登入/註冊表單 ===== */
function LoginForm({ onLoggedIn }: { onLoggedIn: (auth: AuthState) => void }) {
  const [serverUrl, setServerUrl] = useState(window.location.origin);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const url = serverUrl.trim().replace(/\/+$/, '');
      const base = url === window.location.origin ? '' : url;
      const res =
        mode === 'login'
          ? await login(base, email.trim(), password)
          : await register(base, email.trim(), password);
      const auth: AuthState = { serverUrl: base, token: res.token, email: res.email };
      setAuth(auth);
      onLoggedIn(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : '連線失敗，請確認伺服器網址');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <p className="hint" style={{ margin: 0 }}>
        登入自架的同步伺服器後，行程會在你的裝置之間同步；沒有帳號也可以繼續離線使用所有功能。
      </p>
      <label>
        伺服器網址
        <input
          type="url"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="http://100.x.x.x:8787"
        />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </label>
      <label>
        密碼{mode === 'register' && '（至少 8 碼）'}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? '處理中…' : mode === 'login' ? '登入' : '註冊新帳號'}
      </button>
      <button
        type="button"
        className="text-btn"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? '還沒有帳號？註冊一個' : '已經有帳號？改為登入'}
      </button>
    </form>
  );
}

/* ===== 主頁面 ===== */
export default function AccountPage() {
  const [auth, setAuthState] = useState<AuthState | null>(getAuth());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const lastSync = useLiveQuery(async () => (await db.meta.get('lastSyncDisplay'))?.value, []);

  async function runSync(resolve?: 'local' | 'remote') {
    setBusy(true);
    setResult(null);
    const res = await syncNow(resolve);
    setResult(res);
    setBusy(false);
  }

  function handleLogout() {
    if (!window.confirm('確定要登出嗎？本機資料會保留，只是停止同步。')) return;
    clearAuth();
    setAuthState(null);
    setResult(null);
  }

  return (
    <div className="page with-nav">
      <header className="app-header">
        <h1>帳號與同步</h1>
      </header>

      {!auth ? (
        <LoginForm
          onLoggedIn={(a) => {
            setAuthState(a);
            runSync();
          }}
        />
      ) : (
        <>
          <div className="summary-card">
            <h2>已登入</h2>
            <div className="account-row">
              <span className="account-email">{auth.email}</span>
              <button type="button" className="edit-toggle" onClick={handleLogout}>
                登出
              </button>
            </div>
            <p className="hint">
              伺服器：{auth.serverUrl || window.location.origin}
              {lastSync && ` · 上次同步 ${formatTime(lastSync)}`}
            </p>
          </div>

          <div className="summary-card">
            <h2>同步</h2>
            <button
              type="button"
              className="btn-primary"
              style={{ width: '100%' }}
              disabled={busy}
              onClick={() => runSync()}
            >
              {busy ? '同步中…' : '立即同步'}
            </button>

            {result && (
              <p
                className={`sync-message ${
                  result.status === 'error' || result.status === 'conflict' ? 'warn' : 'ok'
                }`}
              >
                {result.message}
              </p>
            )}

            {result?.status === 'conflict' && (
              <div className="form-row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => runSync('remote')}
                >
                  使用雲端版本
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy}
                  onClick={() => runSync('local')}
                >
                  保留本機版本
                </button>
              </div>
            )}

            <p className="hint">
              開啟 App 時會自動同步；「立即同步」會依修改時間自動決定上傳或下載。
            </p>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}
