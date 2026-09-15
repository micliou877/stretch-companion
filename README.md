# 伸展夥伴 (Stretch Companion)

早晚伸展計時與紀錄 App，針對**體態改善 / 馬拉松恢復 / 僵直性脊椎炎**設計。

## 功能
- 早晨 / 睡前兩組課表，引導模式逐項計時
- 每秒節拍音、最後 3 秒高音提示
- 可設定的換動作準備間隔（0–10 秒）
- 語音（zh-TW）報動作名稱與提示詞
- 月曆：自己點日期打勾／取消，自動計算連續天數
- 資料存在瀏覽器 localStorage，離線可用（PWA）

## 本機開發
```bash
npm install
npm run dev        # 開發伺服器
npm run build      # 產出靜態檔到 dist/
npm run preview    # 預覽 build 結果
```

## 推到你的 GitHub
在 GitHub 建一個空 repo（不要勾 README），然後在專案資料夾執行：
```bash
git remote add origin https://github.com/<你的帳號>/<repo名>.git
git branch -M main
git push -u origin main
```
（本專案已內含初始 commit，直接 push 即可。）

## 部署（擇一）
- **GitHub Pages**：`npm run build` 後把 `dist/` 內容發佈到 Pages；或用 GitHub Actions。
- **Netlify / Vercel**：連結 repo，build 指令 `npm run build`，輸出目錄 `dist`。
- 由於 `vite.config.js` 設 `base: "./"`（相對路徑），子路徑部署也不會壞。

## 備註
- Tailwind 目前用 CDN（`index.html` 內），方便零設定。若要正式化可改成 PostCSS 建置版。
- 語音需裝置有中文 TTS；iPhone 於「設定 → 輔助使用 → 語音內容」安裝中文語音。
