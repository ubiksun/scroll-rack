# Changelog

One section per version, newest first; each version in English, then 简体中文. Write the effect, not the implementation.
`scripts/release.sh "en" "zh"` takes one-line notes for the in-app update banner; the GitHub release body is the version's section below; the store "What's new" field gets the same text.

每个版本一节,最新在上;每节先英文,后简体中文。写效果,不写实现。
`scripts/release.sh "英文一句" "中文一句"` 生成应用内更新横幅的说明;GitHub Release 正文用本文件对应的一节;商店「新功能」栏贴同一段。

## v0.14.1 — 2026-10-02

Copy-only release: everything a user can read now exists in English and 简体中文.

### Changed
- All interface text follows the interface language; strings that were English-only (sort menu, set list, tooltips, status line, export menu, update banner, Oracle panel) are now translated.
- The scryfall.com panel and badges follow the browser language.
- The update banner shows release notes in the interface language.
- README, privacy policy and install guide have 简体中文 versions.

### Known issue
- Panel titles stored in a saved layout keep the language they were saved in; ⟲ layout refreshes them.

### 变更
- 全部界面文字跟随界面语言;原先只有英文的字串(排序菜单、系列列表、提示、状态栏、导出菜单、更新横幅、规则文字面板)已翻译。
- scryfall.com 上的面板与徽章跟随浏览器语言。
- 更新横幅按界面语言显示版本说明。
- README、隐私政策、安装说明提供简体中文版。

### 已知问题
- 已保存布局中的面板标题保留保存时的语言;按 ⟲ 布局 刷新。

## v0.14.0 — 2026-10-01

### Added
- First-run guide: seven coach-mark steps over the real controls (sets, search, search scope, open a card, tags, links, rate); targets stay usable during the guide; a "Getting started" checklist (top left) stays until its four items are done. Reopen from ⚙ About → "Show the guide".
- Search button: typing no longer queries; Enter or 🔍 sends the query to Scryfall.
- Click semantics: click selects, double-click opens the card panel, right-click shows the rules text in a popover.
- Links: drag a card from the grid onto the card panel to link the two; the "Link to a card" box supports ↑ ↓ and Enter and searches Scryfall from 3 letters; linked cards stack beside the card image.
- ⚙ Workspace: save, load, export and import named layouts.
- ⚙ Experimental → Wired panels: Image, Comments and Oracle follow a Search panel through the dot on their tab; three link styles switchable under ⚙ Display.
- Interface and card language follow the browser language on first run.

### Changed
- Chinese interface is Simplified; the Chinese name is 卷轴架.
- "Comment display" renamed "Card badges"; "Echoverse pair" is 镜像 in Chinese.
- Oracle panel settings moved into ⚙ Language.
- The card image always shows the whole card: 360px wide at most, shrinks with the panel, never grows with it.
- A second search's card panel stacks into the existing card tab group instead of opening a new column.
- Hovering the tier board lifts only the hovered card; collapsing a comment section pulls the sections below up at once.
- Renaming a tier moves the ratings already given under the old name.
- "Load the newest set" includes sets releasing within the next 14 days.

### Removed
- Top-bar `+ Card`, the Graph tab, the Oracle pop-out button on the card panel, the shortcut hint under the card view, all ⌘ shortcuts.

### Fixed
- The same pair of cards could be linked twice; existing duplicates are merged on start.
- FRA "Way of the …" mirror pairs were wrong (207↔239, 208↔255, 223↔254, 224↔267, 238↔268); cached FRA data is recomputed.
- A mirror partner no longer also appears in the links list.

### 新增
- 首次使用引导:七步遮罩引导,逐步高亮真实控件(系列、搜索、搜索范围、打开单卡、标签、链接、评分),目标区域在引导中可直接操作;左上角「开始使用」清单保留到四项完成。⚙ 关于 →「查看引导」可重开。
- 搜索按钮:输入不再即时查询,按 Enter 或 🔍 才向 Scryfall 发送。
- 点击方式:单击选中,双击在单卡面板打开,右键显示规则文字浮窗。
- 链接:把网格中的卡拖到单卡面板即建立链接;「链接到卡」输入框支持 ↑ ↓ 选择、Enter 确认,3 个字以上同时搜索 Scryfall。已链接的卡以堆叠形式显示在卡图右侧。
- ⚙ 工作区:保存、加载、导出、导入命名布局。
- ⚙ 实验性功能 → 连动面板:卡图、评语、规则文字面板通过标签页上的圆点跟随某个搜索,三种连动样式可在 ⚙ 显示 切换。
- 首次启动时界面与卡牌语言跟随浏览器语言。

### 变更
- 界面中文改为简体;中文名称为「卷轴架」。
- 「评语显示」改名「卡图徽章」;「对子」改名「镜像」。
- 规则文字面板的设置并入 ⚙ 语言。
- 卡图始终完整显示:最宽 360px,随面板缩小,不随面板放大。
- 第二个搜索的单卡面板叠入已有的单卡标签页组,不再另开一栏。
- 评语板悬停只抬起当前一张;评语区收起一段时下方立即上移。
- 修改档位名称时,已按旧名打过的评分一并迁移。
- 「加载最新系列」包含发售前 14 天内的系列。

### 移除
- 顶栏 `+ 单卡`、Graph 标签页、单卡面板的规则文字弹出按钮、单卡视图底部的快捷键提示、所有 ⌘ 快捷键。

### 修复
- 同一对卡可能被记录两次链接,启动时自动合并既有重复。
- FRA「Way of the …」五对镜像配对错误(207↔239、208↔255、223↔254、224↔267、238↔268),已缓存的 FRA 自动重算。
- 镜像伙伴不再同时出现在链接列表中。

## v0.10.0 — 2026-09-22

- Multi-panel workspace: every search panel has its own query; several card panels at once; three Oracle panel modes.
- Options page redesigned; "contexts" renamed "comments"; About page.
- Card images pick a resolution by screen pixel density.

- 多面板工作区:每个搜索面板独立查询;单卡面板可多开;规则文字面板三种模式。
- 设置页重做;「情境」改名「评语」;关于页。
- 卡图按屏幕像素密度选择清晰度。
