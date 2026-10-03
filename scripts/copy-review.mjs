#!/usr/bin/env node
// Copy review: every user-visible string, English beside 简体中文, in one Markdown file.
// Run before a release commit:  node scripts/copy-review.mjs [out.md]
// Sources: src/i18n.ts (app UI), public/_locales (manifest + scryfall.com overlay),
// release/latest.json (update banner), CHANGELOG.md, release/PUBLISH.md (store listing),
// README / PRIVACY / release/INSTALL (single-file bilingual docs). Usage column = files referencing the key (dead keys go to the appendix).
import { build } from 'esbuild'
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = process.argv[2] || join(root, 'release', 'copy-review.md')
const rd = (p) => readFileSync(join(root, p), 'utf8')

// --- 1. app dictionaries ----------------------------------------------------
const tmp = join(tmpdir(), `i18n-${Date.now()}.mjs`)
await build({ entryPoints: [join(root, 'src/i18n.ts')], outfile: tmp, format: 'esm', bundle: false, platform: 'node' })
const { DICTS } = await import(pathToFileURL(tmp).href)
const { en, zh } = DICTS

// group keys by the `// comment` lines inside the en block of i18n.ts
const src = rd('src/i18n.ts')
const enBlock = src.slice(src.indexOf('const en = {'), src.indexOf('const zh:'))
const groups = []
let cur = { title: 'Core', keys: [] }
for (const line of enBlock.split('\n').slice(1)) {
  const c = line.match(/^\s*\/\/\s*(.+)$/)
  if (c) { if (cur.keys.length) groups.push(cur); cur = { title: c[1].trim(), keys: [] }; continue }
  for (const m of line.matchAll(/(?:^|[\s{,])([A-Za-z0-9_]+):\s*['"`]/g)) if (m[1] in en && !cur.keys.includes(m[1])) cur.keys.push(m[1])
}
if (cur.keys.length) groups.push(cur)

// usage: which src files reference each key (any quoted literal)
const files = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) && !p.endsWith('i18n.ts') && files.push(p) } }
walk(join(root, 'src'))
const texts = files.map((p) => [relative(join(root, 'src'), p), readFileSync(p, 'utf8')])
// direct = t('key') / tx('key') / T('key'); indirect = the bare literal elsewhere (e.g. a `group: 'optAbout'` later passed to t(), or a mode value that merely shares the name)
const direct = (k) => texts.filter(([, s]) => new RegExp(`\\b(t|tx|T)\\(\\s*['"]${k}['"]`).test(s)).map(([n]) => n.replace(/\.tsx?$/, ''))
const indirect = (k) => texts.filter(([, s]) => s.includes(`'${k}'`) || s.includes(`"${k}"`)).map(([n]) => n.replace(/\.tsx?$/, ''))
const usage = (k) => { const d = direct(k); if (d.length) return d; const i = indirect(k); return i.length ? ['(indirect) ' + i.join(', ')] : [] }

const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
const row = (k, e, z, u) => `| \`${k}\` | ${esc(e)} | ${esc(z)} | ${u} |`

let md = ''
const H = (s) => { md += `\n${s}\n\n` }
const P = (s) => { md += `${s}\n\n` }

const date = new Date().toISOString().slice(0, 10)
const ver = JSON.parse(rd('public/manifest.json')).version
H(`# Scroll Rack 文案审核 / Copy review — v${ver} (${date})`)
P(`每一条用户可见的文字,英文与简体中文并列。右列 = 引用该键的源文件(表 A);无引用的键列在附录 Z,不显示给用户。\nEvery user-visible string, English beside 简体中文. "Used in" = source files referencing the key; keys nobody references are in appendix Z and never render.\n\n生成: \`node scripts/copy-review.mjs\` — 改完 \`src/i18n.ts\` / \`_locales\` / \`CHANGELOG.md\` 后重跑即可刷新。`)

// --- A. app UI
H('## A · 应用界面 App UI (`src/i18n.ts`)')
const dead = []
for (const g of groups) {
  const live = g.keys.filter((k) => { const u = usage(k); if (!u.length) { dead.push(k); return false } return true })
  if (!live.length) continue
  H(`### A · ${g.title}`)
  md += '| key | English | 简体中文 | used in |\n|---|---|---|---|\n'
  for (const k of live) md += row(k, en[k], zh[k], usage(k).join(', ')) + '\n'
}

// --- B. manifest + overlay
H('## B · 扩展名称 / 商店卡片 / scryfall.com 覆盖层 (`public/_locales`)')
P('Chrome 按浏览器语言选用 `en` / `zh_CN` / `zh_TW`(`zh_TW` 目前与 `zh_CN` 同为简体,见 D-5)。`$SET$` 在运行时替换为系列代码。')
const loc = (l) => JSON.parse(rd(`public/_locales/${l}/messages.json`))
const le = loc('en'), lz = loc('zh_CN')
md += '| key | English | 简体中文 | where |\n|---|---|---|---|\n'
const where = { extName: 'manifest · store · chrome://extensions', extDesc: 'store card · chrome://extensions', actionTitle: 'toolbar button tooltip' }
for (const k of Object.keys(le)) md += row(k, le[k].message, lz[k]?.message ?? '⚠ missing', where[k] || 'content.ts (scryfall.com panel)') + '\n'

// --- C. update banner
H('## C · 应用内更新横幅 In-app update banner (`release/latest.json`)')
const latest = JSON.parse(rd('release/latest.json'))
P(`横幅文字 = \`updateNew\` + notes(按界面语言取 \`notes\` / \`notes_zh\`,见表 A)。当前线上 latest.json(v${latest.version}):`)
md += '| field | text |\n|---|---|\n'
md += `| notes (EN) | ${esc(latest.notes || '⚠ 空 — 线上文件目前只有中文')} |\n| notes_zh | ${esc(latest.notes_zh || '⚠ 空')} |\n\n`
P('下一次发布用 `scripts/release.sh "<EN>" "<ZH>"` 写入两种语言;建议一句话各 ≤120 字符:')
md += '```\nEN: First-run guide; search runs on Enter; click selects, double-click opens, right-click shows rules text; drag to link cards; saved workspaces; Simplified Chinese UI\nZH: 首次使用引导;搜索改为 Enter 执行;单击选中、双击打开、右键规则文字;拖卡建立链接;工作区保存;界面简体中文\n```\n\n'

// --- D. flags
H('## D · 需要你决定的点 Decisions')
P(`已拍板(10/2):分页、「」保留;CHANGELOG 每版同节先英后中;zh_TW 暂与 zh_CN 同为简体;已保存布局的面板标题不随语言切换(已写入已知问题);README / PRIVACY / INSTALL 各为单文件双语(顶部锚点)。新增需要决定的点写在这里。`)

// --- E. changelog + release notes
H('## E · CHANGELOG(= GitHub Release v0.14.0 正文)')
P('下文为 `CHANGELOG.md` 全文;用户审核后,v0.14.0 段落将用 `gh release edit v0.14.0 --notes-file` 覆盖线上 Release 正文。')
md += rd('CHANGELOG.md').replace(/^# /m, '### ').replace(/^## /gm, '#### ').replace(/^### (Added|Changed|Removed|Fixed|新增|变更|移除|修复)/gm, '**$1**') + '\n'

// --- F. store listing
H('## F · Chrome Web Store 商店文案 (`release/PUBLISH.md`)')
const pub = rd('release/PUBLISH.md')
const cut = (s, a, b) => { const i = s.indexOf(a); if (i < 0) return '⚠ section not found'; const j = b ? s.indexOf(b, i + a.length) : -1; return s.slice(i, j < 0 ? undefined : j).trim() }
md += cut(pub, '## Store listing text', '## Store listing text (简体中文)').replace(/^## /m, '### ') + '\n\n'
md += cut(pub, '## Store listing text (简体中文)').replace(/^## /m, '### ') + '\n\n'

// --- G. docs
H('## G · 文档 Docs(GitHub 仓库首页 / 隐私政策 / 侧载说明)')
md += '| file | status |\n|---|---|\n'
md += '| `README.md` | 单文件双语:顶部锚点 English / 简体中文 |\n| `PRIVACY.md` | 单文件双语:顶部锚点 English / 简体中文 |\n| `release/INSTALL.md` | 单文件双语:English 段 + 简体中文 段 |\n\n'
for (const f of ['README.md', 'PRIVACY.md', 'release/INSTALL.md']) {
  H(`### G · \`${f}\``)
  md += rd(f).replace(/^(#+) /gm, (_, h) => '#'.repeat(Math.min(h.length + 3, 6)) + ' ') + '\n'
}

// --- Z. dead keys
H('## Z · 附录:无引用的键(不会显示,可删)')
P('这些键在 `src/` 没有任何引用,用户看不到。列出只为确认可以清理。')
md += '| key | English | 简体中文 |\n|---|---|---|\n'
for (const k of dead) md += `| \`${k}\` | ${esc(en[k])} | ${esc(zh[k])} |\n`

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, md)
console.log(`${out}\nkeys: ${Object.keys(en).length} total · ${Object.keys(en).length - dead.length} used · ${dead.length} unused`)
