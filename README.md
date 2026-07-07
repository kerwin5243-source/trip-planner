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
- [ ] **第二階段**：帳號與同步後端（NestJS/Hono + SQLite + JWT，Docker 自架）
- [ ] **第三階段**：補齊 FRP 功能模組 — ✅ 記帳（多幣別、分帳結算）→ ✅ 行李清單（預設 12 項、自訂項目、進度條）→ 伴手禮 → 交通 → 世界地圖迷霧
- [ ] **第四階段**：地點搜尋 (Nominatim)、天氣 (Open-Meteo)、PDF 匯出、AI 行程生成

## 待辦

- [ ] PNG 版 app icon（iOS 主畫面 apple-touch-icon 不吃 SVG，目前 iOS 安裝後 icon 會是預設截圖）
- [ ] 行程項目拖曳排序、跨日移動（參考 TREK）

## 相關專案

- [FRP](https://github.com/xxjourney/FRP) — Flutter 原生版，功能規格來源
- [busan-trip](https://github.com/kerwin5243-source/busan-trip) / [shikoku-trip](https://github.com/kerwin5243-source/shikoku-trip) — 單行程靜態 PWA 前身
