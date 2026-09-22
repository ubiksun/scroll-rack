# Scroll Rack v0.10.0 — 測試版安裝說明 / Tester Install Guide

**Chrome Web Store: https://chromewebstore.google.com/detail/scroll-rack/oejlhhgcahmkcocomlkocjccnandkmdp**

The steps below are only needed for side-loading a build that is not on the store yet.


> 未上架 Chrome Web Store 的內測版。用「載入未封裝」方式安裝,不需要 Node、不需要 build。
> Pre-release build, not on the Web Store. Installs as an unpacked extension; no Node or build step needed.

## 這是什麼 / What it is

MTG 個人卡牌知識層:對每張卡按情境(Limited / Constructed,可自訂)打檔位、寫筆記、加 tag、把卡和卡連起來看圖譜——在獨立的評分頁裡,也直接疊在 scryfall.com 上。

A personal card-knowledge layer for MTG: rate every card per context (Limited / Constructed, customisable), keep notes, tag cards, link cards into a graph — in a grader tab and directly on scryfall.com.

## 安裝 / Install

1. 解壓 `scroll-rack-v0.10.0.zip` 到一個**不會刪掉**的位置(Chrome 之後一直從這裡讀)。
   Unzip to a folder you'll keep — Chrome loads the extension from it every time.
2. Chrome 網址欄輸入 `chrome://extensions`
3. 右上角開 **開發人員模式 / Developer mode**
4. 點 **載入未封裝項目 / Load unpacked** → 選解壓出來的資料夾(裡面直接有 `manifest.json` 的那一層)
5. 工具列拼圖圖示 🧩 → 釘選 **Scroll Rack** → 點它開評分頁

Edge / Brave 等 Chromium 瀏覽器步驟相同。Mac / Windows 同一個 zip。
Same steps on Edge / Brave. One zip for Mac and Windows.

> Chrome 每次啟動會問一次「停用開發人員模式擴展?」→ 點取消。這是 Chrome 對所有側載擴展的固定提示,不是錯誤。
> Chrome asks "Disable developer mode extensions?" on every launch → Cancel. Standard for any side-loaded extension.

## 第一次使用 / First run

1. 評分頁左上 **Sets ▾** → 勾一個系列(FRA = Reality Fracture,HOB = The Hobbit)→ 自動從 Scryfall 拉整套卡
2. 四個面板都是 tab,可拖動分屏 / 疊放 / 拉出浮動;頂欄 **⟲ layout** 恢復預設
   - **Browse**:Grid(總覽)/ Card(大圖逐張翻)/ Board(把卡拖到檔位列上評分)
   - **Graph**:卡與卡的連結圖
   - **Card**:每個情境一個可收合區塊(檔位 + 筆記)、Tags、Links
   - **Oracle**:規則文字
3. 開任何 scryfall.com 卡頁,右上會浮出同一套面板;搜索結果網格上已評的卡會有檔位徽章
4. 搜索框用 **Scryfall 語法**(`t:creature cmc<=2 o:flying`、`otag:removal`),離線時退回本地文字搜索

## 鍵盤 / Keyboard(焦點不在輸入框時)

`←` `→` 上一張 / 下一張 · `1`–`9` 給第一個情境評檔 · `n` 跳到筆記 · `Esc` Card 視圖回 Grid

## 數據 / Data

- 全部存在**你自己的 Chrome**(IndexedDB),不上傳、沒有帳號。
- **export ▾ → JSON backup** 導出全部;**import** 把別人的備份合併進來(同一張卡較新的評分覆蓋,連結去重)。
- 更新版本:解壓新 zip 覆蓋同一資料夾 → `chrome://extensions` 該卡片上按 ↻。數據不受影響。
- 卸載擴展會清掉數據,卸載前先 export。

All data lives in your own Chrome. Export before uninstalling; updating in place keeps everything.

## 反饋 / Feedback

請寫三樣:**在哪個視圖**(Grid / Card / Board / Graph / scryfall.com)、**預期什麼**、**實際看到什麼**。截圖最好。
Please note: which view, what you expected, what happened. Screenshots help.

## 已知未完成 / Not yet

- 17lands 社群數據層(已寫,暫時關閉)
- 中文卡名 / 大學院廢墟覆蓋層
- 套牌導入 → 自動連結;自動 tag
- 兩台機器之間的自動同步(目前只有 export / import)
