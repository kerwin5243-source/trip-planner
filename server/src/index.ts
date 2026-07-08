/**
 * ============================
 * trip-planner 同步後端
 * ============================
 * Hono + better-sqlite3 + JWT。
 * 設計：每個使用者一份完整資料快照（JSON），客戶端整份上傳/下載，
 * 以 updatedAt 做「最後寫入者勝」；同時服務打包好的前端 (client-dist/)，
 * 這樣手機直接開伺服器網址就能用，不會有 HTTPS 頁面打 HTTP API 的問題。
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';

const PORT = Number(process.env.PORT ?? 8787);
const DATA_DIR = process.env.DATA_DIR ?? './data';
const JWT_SECRET = process.env.JWT_SECRET ?? '';
const ALLOW_REGISTRATION = (process.env.ALLOW_REGISTRATION ?? 'true') !== 'false';
const TOKEN_DAYS = 30;

if (!JWT_SECRET) {
  console.error('缺少 JWT_SECRET 環境變數（請設定一串隨機字串）');
  process.exit(1);
}

/* ===== 資料庫 ===== */
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(`${DATA_DIR}/trip-planner.db`);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

/* ===== App ===== */
const app = new Hono<{ Variables: { userId: string } }>();

app.use('/api/*', cors()); // 開放 CORS，開發時 vite dev server 也能打

async function issueToken(userId: string): Promise<string> {
  return sign(
    { sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400 },
    JWT_SECRET,
  );
}

/** Bearer token 驗證 middleware */
app.use('/api/*', async (c, next) => {
  const path = c.req.path;
  if (path === '/api/auth/register' || path === '/api/auth/login' || path === '/api/health') {
    return next();
  }
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: '未登入' }, 401);
  try {
    const payload = await verify(auth.slice(7), JWT_SECRET, 'HS256');
    c.set('userId', String(payload.sub));
  } catch {
    return c.json({ error: '登入已過期，請重新登入' }, 401);
  }
  return next();
});

app.get('/api/health', (c) => c.json({ ok: true, name: 'trip-planner-server' }));

app.post('/api/auth/register', async (c) => {
  if (!ALLOW_REGISTRATION) return c.json({ error: '此伺服器已關閉註冊' }, 403);
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  if (!email?.includes('@') || !password || password.length < 8) {
    return c.json({ error: '請提供有效的 email 與至少 8 碼的密碼' }, 400);
  }
  const normalized = email.trim().toLowerCase();
  const exists = db.prepare('SELECT 1 FROM users WHERE email = ?').get(normalized);
  if (exists) return c.json({ error: '這個 email 已經註冊過了' }, 409);
  const user: UserRow = {
    id: randomUUID(),
    email: normalized,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: new Date().toISOString(),
  };
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)').run(
    user.id,
    user.email,
    user.password_hash,
    user.created_at,
  );
  return c.json({ token: await issueToken(user.id), email: user.email });
});

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email?.trim().toLowerCase() ?? '') as UserRow | undefined;
  if (!user || !password || !bcrypt.compareSync(password, user.password_hash)) {
    return c.json({ error: 'email 或密碼錯誤' }, 401);
  }
  return c.json({ token: await issueToken(user.id), email: user.email });
});

app.get('/api/me', (c) => {
  const user = db.prepare('SELECT email, created_at FROM users WHERE id = ?').get(
    c.get('userId'),
  ) as Pick<UserRow, 'email' | 'created_at'> | undefined;
  if (!user) return c.json({ error: '找不到使用者' }, 404);
  return c.json(user);
});

/** 下載雲端快照（沒有快照時 data 為 null） */
app.get('/api/sync', (c) => {
  const row = db
    .prepare('SELECT data, updated_at FROM snapshots WHERE user_id = ?')
    .get(c.get('userId')) as { data: string; updated_at: string } | undefined;
  if (!row) return c.json({ data: null, updatedAt: null });
  return c.json({ data: JSON.parse(row.data), updatedAt: row.updated_at });
});

/** 上傳整份快照（最後寫入者勝） */
app.put('/api/sync', async (c) => {
  const body = await c.req.json<{ data: unknown }>();
  if (!body?.data || typeof body.data !== 'object') {
    return c.json({ error: '快照格式錯誤' }, 400);
  }
  const raw = JSON.stringify(body.data);
  if (raw.length > 20 * 1024 * 1024) return c.json({ error: '快照超過 20MB 上限' }, 413);
  const updatedAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO snapshots (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(c.get('userId'), raw, updatedAt);
  return c.json({ updatedAt });
});

/* ===== 前端靜態檔（正式部署時把 vite build 的 dist 放到 client-dist/） ===== */
app.use('*', serveStatic({ root: './client-dist' }));
app.use('*', serveStatic({ root: './client-dist', path: 'index.html' })); // SPA fallback

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`trip-planner server 跑起來了：http://localhost:${info.port}`);
});
