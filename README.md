# Scroll Rack (Chrome extension)

[English](#english) · [简体中文](#简体中文)

## English

**Scroll Rack is a browser extension for rating and annotating Magic: The Gathering cards.**

Rate every card on as many **comments** as you like (Limited / Constructed / …, each with its own tier ladder), keep
notes, **tag** cards, **link** cards into an Obsidian-style graph — in an app tab AND directly on **scryfall.com**
(floating panel on card pages, tier badges on search grids). Search uses Scryfall's own syntax (proxied to the API).

### Install

**[Get it on the Chrome Web Store](https://chromewebstore.google.com/detail/scroll-rack/oejlhhgcahmkcocomlkocjccnandkmdp)** — one click, auto-updating.

**Or from GitHub** — download `scroll-rack-vX.Y.Z.zip` from [Releases](https://github.com/ubiksun/scroll-rack/releases),
unzip it somewhere permanent, then open `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick
the unzipped folder. To update, unzip the newer version over the same folder and hit ↻ on the extension card. Your
ratings and notes live in Chrome's profile, not in that folder, so they survive the overwrite.

### Roadmap

- Auto-tags: Scryfall Tagger `otag:` (bulk `oracle_tags`) as first source, rules-text heuristics second, LLM batch offline third
- Review scorecard (Spearman vs 17lands / vs reviewer aggregates, ±1 tier hit rate) once a set is stable

### Legal

Unofficial fan project. Not affiliated with, endorsed, sponsored, or approved by Wizards of the Coast. Magic: The Gathering
and card names, text and images are © Wizards of the Coast LLC. Card data and images via [Scryfall](https://scryfall.com),
Chinese data via [大學院廢墟](https://mtgch.com). MIT licensed — see LICENSE.

### Privacy

Everything you enter stays in your browser's IndexedDB. The extension makes network requests only to api.scryfall.com /
cards.scryfall.io (card data & images), mtgch.com (Chinese card data, only when card language = 中文), tagger.scryfall.com
(only with the experimental Tagger option on), and raw.githubusercontent.com (version check). No analytics, no accounts.

---

## 简体中文

**卷轴架是一款用于对万智牌进行评分和注释的浏览器扩展程序。**

为每张卡建立任意多条**评语**(Limited / Constructed / …,每条有自己的档位阶梯)并打档位、写笔记、加**标签**、把卡**链接**成 Obsidian 式的图谱——既在独立的应用页里,也直接显示在 **scryfall.com** 上(卡牌页的浮动面板、搜索网格上的档位徽章)。搜索使用 Scryfall 自己的语法(经由 API 代理)。

### 安装

**[从 Chrome Web Store 安装](https://chromewebstore.google.com/detail/scroll-rack/oejlhhgcahmkcocomlkocjccnandkmdp)** —— 一键安装,自动更新。

**或从 GitHub 安装** —— 在 [Releases](https://github.com/ubiksun/scroll-rack/releases) 下载 `scroll-rack-vX.Y.Z.zip`(Assets 里的那个,不是 Source code),解压到一个长期保留的位置,然后打开 `chrome://extensions` → 开启**开发者模式** → **加载已解压的扩展程序** → 选择解压出的文件夹。更新时把新版本解压覆盖同一文件夹,再在扩展卡片上按 ↻。评分和笔记保存在 Chrome 的用户配置里,不在该文件夹中,覆盖不会丢失。

### 路线图

- 自动标签:第一来源为 Scryfall Tagger 的 `otag:`(批量 `oracle_tags`),其次为规则文字的启发式规则,最后为离线的 LLM 批处理
- 评分回测(与 17lands / 评测者汇总的 Spearman 相关性、±1 档命中率),待系列稳定后

### 法律声明

非官方同人项目。与 Wizards of the Coast 无关,未经其认可、赞助或批准。Magic: The Gathering 及卡牌名称、文字与图像 © Wizards of the Coast LLC。卡牌数据与图像来自 [Scryfall](https://scryfall.com),中文数据来自 [大学院废墟](https://mtgch.com)。MIT 许可 —— 见 LICENSE。

### 隐私

你输入的一切都只保存在浏览器的 IndexedDB 中。扩展只向以下地址发起网络请求:api.scryfall.com / cards.scryfall.io(卡牌数据与图像)、mtgch.com(中文卡牌数据,仅当卡牌语言设为中文时)、tagger.scryfall.com(仅当开启实验性的 Tagger 选项时)、raw.githubusercontent.com(版本检查)。无统计,无账号。
