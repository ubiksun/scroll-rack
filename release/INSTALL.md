# Scroll Rack v0.14.0 — Install Guide / 安装说明

**Chrome Web Store: https://chromewebstore.google.com/detail/scroll-rack/oejlhhgcahmkcocomlkocjccnandkmdp**

The steps below are only needed for side-loading a build that is not on the store yet.
以下步骤仅用于侧载尚未上架商店的版本。

---

## English

### Install

1. Unzip `scroll-rack-v0.14.0.zip` to a folder you will keep — Chrome loads the extension from it every time.
2. Open `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. **Load unpacked** → pick the unzipped folder (the one that contains `manifest.json`).
5. Toolbar puzzle icon 🧩 → pin **Scroll Rack** → click it to open the app page.

Same steps on Edge / Brave. One zip for Mac and Windows.

> Chrome asks "Disable developer mode extensions?" on every launch → Cancel. Standard for any side-loaded extension, not an error.

### First run

A seven-step guide opens on first launch and walks the real controls: load a set, search, search scope, open a card, tags, links, rate. Reopen it any time from ⚙ About → "Show the guide".

- **Sets ▾** (top left) — download a set from Scryfall; checked sets appear in the Search panel.
- **Search** — Scryfall syntax (`t:creature cmc<=2 o:flying`), runs on Enter or 🔍. "▣ active sets" searches loaded sets; "🌐 all sets" searches all of Scryfall.
- **Cards** — click selects, double-click opens the card panel, right-click shows the rules text.
- **Card panel** — one block per comment (tier + note), tags, links. Drag a card from the grid onto the panel to link the two.
- **scryfall.com** — the same panel floats on every card page; rated cards get tier badges in search grids.
- Panels are tabs: drag to split or stack; **⟲ layout** restores the default. ⚙ Workspace saves named layouts.

### Keyboard (when no input is focused)

`←` `→` previous / next card · `1`–`9` tier for the first comment · `n` jump to the note · `Esc` close the popover

### Data

- Everything lives in your own Chrome (IndexedDB). No upload, no account.
- **export ▾ → JSON backup** exports everything; **import** merges another backup (newer rating per card wins, links deduplicated).
- Updating: unzip the new zip over the same folder → ↻ on the extension card. Data is untouched.
- Uninstalling the extension deletes its data — export first.

### Feedback

Please note **which view** (Grid / Card / Comments / scryfall.com), **what you expected**, **what happened**. Screenshots help.

---

## 简体中文

### 安装

1. 把 `scroll-rack-v0.14.0.zip` 解压到一个**长期保留**的位置(Chrome 之后一直从这里读取)。
2. 地址栏输入 `chrome://extensions`。
3. 右上角开启**开发者模式**。
4. **加载已解压的扩展程序** → 选择解压出的文件夹(直接包含 `manifest.json` 的那一层)。
5. 工具栏拼图图标 🧩 → 固定**卷轴架** → 点击打开应用页。

Edge / Brave 等 Chromium 浏览器步骤相同。Mac 与 Windows 用同一个 zip。

> Chrome 每次启动会询问「要停用开发者模式扩展程序吗?」→ 点取消。这是 Chrome 对所有侧载扩展的固定提示,不是错误。

### 第一次使用

首次启动会打开七步引导,逐一指向真实控件:加载系列、搜索、搜索范围、打开单卡、标签、链接、评分。之后可随时从 ⚙ 关于 →「查看引导」重开。

- **系列 ▾**(左上)—— 从 Scryfall 下载一个系列;勾选的系列进入搜索面板。
- **搜索** —— Scryfall 语法(`t:creature cmc<=2 o:flying`),按 Enter 或 🔍 执行。「▣ 已启用系列」只搜已加载的系列;「🌐 全部系列」搜索整个 Scryfall。
- **卡牌** —— 单击选中,双击在单卡面板打开,右键显示规则文字。
- **单卡面板** —— 每条评语一个区块(档位 + 笔记)、标签、链接。把网格中的卡拖到面板上即建立链接。
- **scryfall.com** —— 每个卡牌页右上浮出同一套面板;搜索网格中已评分的卡显示档位徽章。
- 面板都是标签页:拖动可分屏或叠放;**⟲ 布局** 恢复默认。⚙ 工作区可保存命名布局。

### 键盘(焦点不在输入框时)

`←` `→` 上一张 / 下一张 · `1`–`9` 给第一条评语打档位 · `n` 跳到笔记 · `Esc` 关闭浮窗

### 数据

- 全部保存在**你自己的 Chrome**(IndexedDB)中,不上传,无账号。
- **导出 ▾ → JSON 备份** 导出全部;**导入** 合并另一份备份(同一张卡较新的评分覆盖,链接去重)。
- 更新版本:把新 zip 解压覆盖同一文件夹 → 在扩展卡片上按 ↻。数据不受影响。
- 卸载扩展会清除数据,卸载前请先导出。

### 反馈

请写明**在哪个视图**(网格 / 单卡 / 评语 / scryfall.com)、**预期什么**、**实际看到什么**。附截图更好。
