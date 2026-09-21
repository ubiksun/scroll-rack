// Minimal i18n layer. UI strings only — card data stays in Scryfall's language until zhs/zht printed names are wired.
export type Lang = 'en' | 'zh'

const en = {
  pickSet: 'Pick a set, or click “+ add set” to pull one from Scryfall.',
  addSet: '+ add set', pullFrom: 'pull from Scryfall…', refetch: 'Re-fetch (spoiler season)',
  editTiers: 'edit tiers', contexts: 'contexts', grid: 'Grid', single: 'Card', graph: 'Graph',
  global: 'global', hop1: '1 hop', hop2: '2 hops',
  community: '17lands', fetch: 'fetch', export: 'export', import: 'import',
  all: 'all', rated: 'rated', unrated: 'unrated', anyTier: 'any tier', anyTag: 'any tag',
  byNumber: 'by number', byTier: 'by my tier', byCommunity: 'by 17lands',
  search: 'Scryfall syntax: t:creature cmc<=2 o:flying …', shown: 'shown', searching: 'searching…', localSearch: 'offline: local name/text search',
  syntaxError: 'Scryfall rejected that query',
  noCards: 'No cards match. Load a set or loosen the filters.',
  notes: 'Notes (markdown ok, saved automatically)',
  communityTitle: 'Community (17lands)', noSnapshot: 'No snapshot loaded for this set.', reveal: 'Reveal for this card',
  notInCommunity: 'Card not in 17lands data (not on Arena yet, or renamed).',
  tags: 'Tags', addTag: 'add tag…', links: 'Links', linkTo: 'Link to card… (type 2+ letters)', why: 'why (optional)',
  oracle: 'Oracle', keywords: 'Keywords', art: 'Art', pinned: 'pinned',
  noLinks: 'No links yet. Open a card and use “Link to card…” to start a graph.',
  exportJson: 'JSON backup (everything)', exportCsv: 'CSV — this set, this context', exportMd: 'Markdown / Obsidian — this set',
  exportList: 'Decklist text — current filter', exportGraph: 'Graph JSON (nodes + edges)',
  edgeTypes: 'edge types', minDegree: 'min links', nodeTag: 'node tag',
  prev: '← prev', next: 'next →', backToGrid: 'grid (Esc)', keysHint: '← → navigate · 1–9 tier · n notes · Esc grid',
  schemeTitle: 'Rating scheme', name: 'Name', tier: '+ tier', cancel: 'Cancel', save: 'Save',
  contextsTitle: 'Rating contexts', addContext: '+ context', scheme: 'scheme',
  language: 'Language', artRegular: 'art: regular', artAlt: 'art: alt',
  options: 'Options', uiLanguage: 'Interface language', cardLanguage: 'Card language', cardLanguageHint: '(names · type · oracle · scans)',
  tagsSection: 'Tags', tagsSectionHint: '(rating dimensions — each can show as a badge on every card image)',
  display: 'Display', echoPairs: 'Echoverse pairs (FRA)', experimental: 'Experimental', close: 'Close',
}
const zh: typeof en = {
  pickSet: '選一個系列,或按「+ 加入系列」從 Scryfall 拉取。',
  addSet: '+ 加入系列', pullFrom: '從 Scryfall 拉取…', refetch: '重新拉取(預覽期)',
  editTiers: '編輯檔位', contexts: '評分情境', grid: '網格', single: '單卡', graph: '圖譜',
  global: '全圖', hop1: '1 跳', hop2: '2 跳',
  community: '17lands', fetch: '抓取', export: '導出', import: '導入',
  all: '全部', rated: '已評', unrated: '未評', anyTier: '任何檔', anyTag: '任何標籤',
  byNumber: '按集號', byTier: '按我的檔', byCommunity: '按 17lands',
  search: 'Scryfall 語法:t:creature cmc<=2 o:flying …', shown: '張', searching: '搜尋中…', localSearch: '本地搜尋（中文名 / 規則文字）',
  syntaxError: 'Scryfall 不接受這個查詢',
  noCards: '沒有符合的卡。載入系列或放寬篩選。',
  notes: '筆記(支援 markdown,自動儲存)',
  communityTitle: '社群數據(17lands)', noSnapshot: '此系列尚未載入快照。', reveal: '揭示這張卡',
  notInCommunity: '17lands 沒有這張卡(尚未上 Arena,或名稱不同)。',
  tags: '標籤', addTag: '加標籤…', links: '連結', linkTo: '連結到卡…(輸入 2 個字以上)', why: '原因(選填)',
  oracle: '規則文字', keywords: '關鍵字', art: '卡圖', pinned: '已釘選',
  noLinks: '尚無連結。打開一張卡,用「連結到卡…」開始建圖。',
  exportJson: 'JSON 備份(全部)', exportCsv: 'CSV — 本系列、本情境', exportMd: 'Markdown / Obsidian — 本系列',
  exportList: '牌表文字 — 目前篩選', exportGraph: '圖譜 JSON(節點 + 邊)',
  edgeTypes: '邊類型', minDegree: '最少連結', nodeTag: '節點標籤',
  prev: '← 上一張', next: '下一張 →', backToGrid: '網格(Esc)', keysHint: '← → 切換 · 1–9 評檔 · n 筆記 · Esc 回網格',
  schemeTitle: '評分檔位', name: '名稱', tier: '+ 檔位', cancel: '取消', save: '儲存',
  contextsTitle: '評分情境', addContext: '+ 情境', scheme: '檔位方案',
  language: '語言', artRegular: '卡圖:一般', artAlt: '卡圖:異畫',
  options: '設定', uiLanguage: '介面語言', cardLanguage: '卡牌語言', cardLanguageHint: '(卡名・類別・規則文字・卡圖)',
  tagsSection: '標籤', tagsSectionHint: '(評分維度——每個都可在卡圖上顯示徽章)',
  display: '顯示', echoPairs: 'Echoverse 對子(FRA)', experimental: '實驗功能', close: '關閉',
}

const dicts: Record<Lang, typeof en> = { en, zh }
let current: Lang = 'en'
export const setLang = (l: Lang) => { current = l }
export const getLang = () => current
export const t = (k: keyof typeof en) => dicts[current][k]
