#!/usr/bin/env node
// Copy review: every user-visible string, English beside 简体中文, in one Markdown file.
// Run before a release commit:  node scripts/copy-review.mjs [out.md]
// Sources: src/i18n.ts (app UI), public/_locales (manifest + scryfall.com overlay),
// release/latest.json (update banner), CHANGELOG.md, release/PUBLISH.md (store listing),
// README / PRIVACY / release/INSTALL (docs). Usage column = files referencing the key (dead keys go to the appendix).
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
P(`1. **分页 vs 标签页** — 面板标签在中文里现为「分页」(${(zh ? Object.values(zh).join(' ').split('分页').length - 1 : 0)} 处);Chrome 自身叫「标签页」。保留或全局替换?
2. **「」 vs “”** — 中文字串里引用控件名时用「」(${Object.values(zh).join(' ').split('「').length - 1} 处),英文用 “ ”。简体出版惯例是 “ ”,但「」在界面里更醒目。保留或替换?
3. **CHANGELOG / Release 顺序** — 每个版本先英文后中文(同一节内);GitHub Release 正文直接贴这一节。接受或改成两个独立版块?
4. **版本号** — 这批改动只有文案(新增 i18n 键 + 覆盖层本地化 + 文档),建议发 **v0.14.1**;\`latest.json\` 同时补上 \`notes\`(英文)。或者只重写 v0.14.0 的 Release 正文、不发新版?
5. **zh_TW** — 目前与 zh_CN 同为简体(你 9/28 的决定:产品中文一律简体)。繁体用户的 Chrome 会读 zh_TW;如删掉该目录,他们会看到英文。保留简体、删掉、还是日后补繁体?
6. **README roadmap** — 「大學院廢墟 (mtgch) overlay」已在 v0.10 上线,建议从 roadmap 移除(README.md + README.zh-CN.md)。
7. **已保存布局里的面板标题不会随语言切换** — 标题(Search 1 / Card / Oracle)在保存时写入布局;切换界面语言后需 ⟲ layout 才更新。接受(写进已知问题)或做迁移?
8. **\`aboutAuthor: Designed by Ubiksun / 设计:Ubiksun\`** — 关于页署名,确认用词。`)

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
md += '| `README.md` | English · 顶部链接到 README.zh-CN.md |\n| `README.zh-CN.md` | 简体中文全文(新) |\n| `PRIVACY.md` | English · 顶部链接到 PRIVACY.zh-CN.md |\n| `PRIVACY.zh-CN.md` | 简体中文全文(新) |\n| `release/INSTALL.md` | 单文件双语:English 段 + 简体中文 段 |\n\n'
for (const f of ['README.md', 'README.zh-CN.md', 'PRIVACY.md', 'PRIVACY.zh-CN.md', 'release/INSTALL.md']) {
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
