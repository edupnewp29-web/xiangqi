# 象棋道場 Xiangqi Dojo

手機就能玩的象棋網站：對弈電腦（七級難度）、教練模式、復盤、殺法與戰術題、名局解說、個人化課程、好友即時對戰、英雄榜與戰績。

## 功能
| 模式 | 說明 |
|---|---|
| 對弈電腦 | 入門～宗師七級（Rating 800～2000）。**教練模式**：每步評分、威脅箭頭、殺棋預警、悔棋與提示（不計分）。**正式對局**：計入 Rating。 |
| 復盤 | 引擎逐步分析，局勢曲線、三大失誤、「從這裡重下」，自動累積弱點統計。 |
| 殺法練習 | 引擎產生並驗證唯一解的二～四步殺，依殺法分類（馬後炮、重炮、悶宮、雙車錯…）。 |
| 戰術題 | 引擎驗證只有一步能得子的局面（捉雙、抽將…）。 |
| 名局欣賞 | 實戰名局逐步解說＋引擎評價，「猜下一步」測驗；可貼上任何中文棋譜自動解說。 |
| 我的課程 | 程度測驗定起點，依弱點推薦課程（殺法・戰術・開局・殘局）。 |
| 好友對戰 | 產生邀請連結，朋友點開即可即時對下（Firebase）。 |
| 英雄榜／戰績 | 正式對局的 Rating 排行與對局紀錄。 |

## 上線步驟

### 1. Firebase（英雄榜、好友對戰需要）
1. [Firebase 主控台](https://console.firebase.google.com) → 新增專案 `xiangqi`
2. **Authentication** → 開始使用 → 登入方式 → 啟用 **匿名**
3. **Firestore Database** → 建立資料庫 → 位置 `asia-east1` → 以正式版模式啟動
4. Firestore → **規則** → 貼上本專案的 `firestore.rules` → 發布
5. 專案設定（齒輪）→ 一般 → 你的應用程式 → 新增 **網頁應用程式** → 複製 `firebaseConfig`
6. 貼到 `js/firebase-config.js`（取代 `null`）
7. Authentication → 設定 → **授權網域** → 加入 `你的帳號.github.io`

> `apiKey` 是公開識別碼，放在前端是正常的；資料安全由 `firestore.rules` 控管。

### 2. GitHub Pages
1. 把整個資料夾推到 GitHub repo（例如 `xiangqi`）
2. repo → Settings → Pages → Source 選 `Deploy from a branch`，Branch 選 `main` / `(root)` → Save
3. 約一分鐘後開啟 `https://你的帳號.github.io/xiangqi/`
4. iPhone：Safari 開啟 → 分享 → 加入主畫面，就像 App 一樣全螢幕

## 檔案
- `js/engine.js` 引擎（PVS、null move、LMR、置換表），`js/worker.js` 背景運算
- `js/coach.js` 中文記譜、棋步解說、殺法辨識
- `js/game.js` 對局畫面（所有模式），`js/app.js` 選單與資料，`js/online.js` Firebase
- `js/data-*.js` 題庫、名局、課程（題庫由引擎產生並驗證）

## 規則說明
- 同一局面重複三次判和（簡化處理，未實作長將、長捉禁著）。
- 匿名登入：同一裝置同一瀏覽器視為同一位玩家；換手機會是新帳號。
