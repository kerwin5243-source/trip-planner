# 旅程規劃 Trip Planner

FRP（Flutter 版旅行紀錄 App）的 Web / PWA 重寫版。
架構參考 [TREK](https://github.com/mauriceboe/TREK)：Vite + React PWA 前端，本機優先 (local-first)，未來接帳號同步後端。

## 技術棧

- **前端**：Vite + React 19 + TypeScript
- **本機資料庫**：IndexedDB（[Dexie](https://dexie.org/)）— 離線可完整使用
- **路由**：react-router-dom
- **PWA**：vite-plugin-pwa（Workbox）— 可安裝到手機主畫面

## 開發

```bash
npm install
npm run dev      # 開發伺服器
npm run build    # 產出 dist/（含 service worker 與 manifest）
npm run preview  # 預覽正式版
```

## 路線圖

- [x] **第一階段**：PWA 骨架、多行程管理（即將出發 / 進行中 / 過去回顧）、手動建立行程、行程表日檢視
- [x] **第三階段**：FRP 功能模組 — ✅ 記帳（多幣別、分帳結算）✅ 行李清單（預設 12 項、自訂項目、進度條）✅ 伴手禮（地區分組、代購對象、購買進度）✅ 交通（按日分組、整合行程表交通項目）✅ 世界地圖迷霧（SVG 自繪、離線可用、中文國名）
- [x] **設計改版**：參考 busan/shikoku PWA 與 TREK — 毛玻璃頁首與底部導覽、柔和漸層背景、Noto Serif TC 標題、Roboto Mono 數字、半透明大圓角卡片；並新增旅程編輯（改名、改日期保留既有行程）
- [x] **第二階段**：帳號與同步後端 — Hono + SQLite + JWT，Docker 自架；整份快照同步、最後寫入者勝、衝突時讓使用者選邊
- [ ] **第四階段**：✅ 地點搜尋 (Nominatim，行程項目自動帶地址座標 + 導航按鈕) → ✅ 天氣 (Open-Meteo，旅程設目的地後行程表顯示每日預報) → PDF 匯出 → AI 行程生成

## 自架同步伺服器

後端在 [server/](server/)（Hono + better-sqlite3 + JWT），會**連同前端一起服務**——
手機直接開伺服器網址就是完整帶帳號的版本，不會碰到 HTTPS 頁面打 HTTP API 的 mixed content 問題
（Vercel 版仍可獨立當免帳號的離線版使用）。

**部署（例如 Tailscale 上的 Ubuntu VM）：**

```bash
git clone https://github.com/kerwin5243-source/trip-planner.git
cd trip-planner
JWT_SECRET=$(openssl rand -hex 32) docker compose up -d --build
# 之後手機/電腦開 http://<Tailscale IP>:8787，到「帳號」頁註冊即可
```

- 資料存在 `./data/trip-planner.db`（SQLite），備份拷這個檔就好
- `ALLOW_REGISTRATION=false` 可在自己註冊完後關閉註冊
- 同步策略：整份快照上傳/下載、最後寫入者勝；兩邊同時有修改會跳衝突讓你選

## 待辦

- [x] PNG 版 app icon（apple-touch-icon 180 + manifest 512/maskable）
- [x] 行程項目跨日移動（編輯表單選日期）
- [ ] 行程項目拖曳排序
- [ ] PDF 匯出、AI 行程生成（第四階段剩餘項目）

## 相關專案

- [FRP](https://github.com/xxjourney/FRP) — Flutter 原生版，功能規格來源
- [busan-trip](https://github.com/kerwin5243-source/busan-trip) / [shikoku-trip](https://github.com/kerwin5243-source/shikoku-trip) — 單行程靜態 PWA 前身
