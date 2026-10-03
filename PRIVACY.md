# Scroll Rack — Privacy Policy

[English](#english) · [简体中文](#简体中文)

## English

_Last updated: 2026-09-21_

Scroll Rack is a browser extension for rating and annotating Magic: The Gathering cards. It is designed so that your data never leaves your browser.

### What the extension stores

Your ratings, notes, tags, card links, rating dimensions, tier schemes and display preferences are stored **locally** in your browser (IndexedDB and `chrome.storage.local`). Cached card data downloaded from the sources below is stored the same way. Nothing is sent to the developer or to any server operated by the developer.

### Network requests the extension makes

The extension only contacts the following third-party services, and only for the purpose stated:

| Service | Purpose | When |
|---|---|---|
| api.scryfall.com, cards.scryfall.io | Card data and card images | When you load a set or search |
| mtgch.com, images.mtgch.com (大學院廢墟) | Chinese card names, text and scans | Only when card language is set to 中文 |
| tagger.scryfall.com | Community functional tags | Only when the experimental "Scryfall Tagger" option is enabled |
| raw.githubusercontent.com | A small JSON file with the latest version number | About every 6 hours |

Requests contain only what is needed to identify a card or set (set code, collector number, search text). They never include your ratings, notes or any personal information. Each service's own privacy policy governs what it logs about requests it receives.

### On scryfall.com

The extension adds a panel and badges to scryfall.com pages so you can see and edit your own ratings there. It reads the page only to identify which card is shown. It does not read or transmit anything else from the page and does not run on any other website.

### What the extension does not do

- No accounts, no sign-in.
- No analytics, telemetry, tracking or advertising.
- No collection of personal information, browsing history or data from other websites.
- No selling or sharing of data with third parties.

### Your control

You can export all of your data at any time as a JSON file (**export → JSON backup**) and delete it entirely by uninstalling the extension, which removes its local storage.

### Contact

Questions: open an issue at https://github.com/ubiksun/scroll-rack/issues

---

## 简体中文

_最后更新:2026-09-21_

卷轴架是一款用于对万智牌进行评分和注释的浏览器扩展程序。它的设计原则是:你的数据永远不离开你的浏览器。

### 扩展保存什么

你的评分、笔记、标签、卡牌链接、评语维度、档位方案和显示偏好都**本地**保存在浏览器中(IndexedDB 与 `chrome.storage.local`)。从下列来源下载的卡牌缓存数据也以同样方式保存。任何内容都不会发送给开发者,也不会发送到开发者运营的任何服务器。

### 扩展发起的网络请求

扩展只联系以下第三方服务,且只为所述目的:

| 服务 | 用途 | 时机 |
|---|---|---|
| api.scryfall.com、cards.scryfall.io | 卡牌数据与卡图 | 加载系列或搜索时 |
| mtgch.com、images.mtgch.com(大学院废墟) | 中文卡名、文字与扫描图 | 仅当卡牌语言设为中文时 |
| tagger.scryfall.com | 社区功能标签 | 仅当开启实验性的「Scryfall Tagger」选项时 |
| raw.githubusercontent.com | 一个记录最新版本号的小 JSON 文件 | 约每 6 小时一次 |

请求只包含识别卡牌或系列所需的内容(系列代码、收集编号、搜索文字),绝不包含你的评分、笔记或任何个人信息。各服务对其收到的请求如何记录,以其自身的隐私政策为准。

### 在 scryfall.com 上

扩展会在 scryfall.com 页面上添加一个面板和徽章,让你在那里查看并编辑自己的评分。它读取页面只是为了识别当前显示的是哪张卡,不读取或传输页面上的其他任何内容,也不在任何其他网站上运行。

### 扩展不做什么

- 无账号,无需登录。
- 无统计、遥测、追踪或广告。
- 不收集个人信息、浏览历史或其他网站的数据。
- 不出售、不与第三方共享数据。

### 你的控制权

你可以随时把全部数据导出为一个 JSON 文件(**导出 → JSON 备份**),也可以通过卸载扩展彻底删除数据(卸载会移除其本地存储)。

### 联系

有问题请在 https://github.com/ubiksun/scroll-rack/issues 提交 issue。
