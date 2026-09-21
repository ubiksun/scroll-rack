# Scroll Rack (Chrome extension)

Your personal card-knowledge layer for MTG: rate every card per **context** (Limited / Constructed / …, each with its own
tier scheme), keep notes, **tag** cards, **link** cards into an Obsidian-style graph, overlay **17lands** data — in a grader
tab AND directly on **scryfall.com** (floating panel on card pages, tier badges on search grids). Search uses Scryfall's
own syntax (proxied to the API).

Project memory: Obsidian vault `claude/projects/MTG限制賽評分工具.md`.

## Build & load

```
npm install
npm run build        # → dist/
```

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → pick `dist/`.
Click the toolbar icon to open the grader in a tab. Re-run `npm run build` (or `npm run watch`) and hit ↻ on the
extension card after code changes.

Quick preview without Chrome extension packaging: `npx vite preview --host 127.0.0.1 --port 4173` — the app page uses no
`chrome.*` APIs, only `background.js` does.

## Data

- Cards: Scryfall `cards/search?q=e:{set}&unique=cards` (variants collapsed), cached in IndexedDB (Dexie). ↻ re-pulls
  during spoiler season.
- Community: `17lands.com/card_ratings/data?expansion=SET&format=PremierDraft` (undocumented, no auth). Empty array
  until the set is on Arena. GIH WR is null until 17lands' own sample threshold — P-badge only shows for cards that pass.
- Ratings are keyed `(set, oracle_id)`; edges are keyed by `oracle_id` so they carry across sets.
- Sync = **export / import JSON** (merge: newest rating wins, edges dedupe on a|b|type). No backend.

## UI = docking layout (dockview)

Four panels — **Browse** (Grid / Card / Board), **Graph**, **Card** (per-context tiers + notes, tags, links), **Oracle** — are
VS Code-style tabs: drag to split, stack, or float; layout persists (⟲ layout resets). Closed panels come back from the
toolbar buttons. All panels read one store (`src/state.tsx`), so selection / filters / ratings stay in sync.

## Layout (files)

```
public/manifest.json   MV3 manifest: module service worker + scryfall.com content script
public/content.css     overlay styles
src/background.ts      service worker — opens the app tab; answers content-script messages against the extension DB
src/content.ts         scryfall.com overlay (import-free; card-page panel + grid badges) — talks to background only
src/messages.ts        message / payload types shared by the two above
src/db.ts              Dexie schema v3 (contexts, ratings keyed set:oracle:context, tags, edges, artPrefs) + export/import
src/api/scryfall.ts    set list + full-set pull (unique=prints → grouped by oracle_id; default art = lowest collector #)
src/api/search.ts      Scryfall-syntax search proxy (e:SET (query) → oracle_ids)
src/api/seventeen.ts   17lands snapshot + GIH percentile
src/export.ts          JSON / CSV / Markdown-Obsidian / decklist text / graph JSON
src/i18n.ts            EN + 中文 UI strings (t())
src/state.tsx          GraderProvider — all app state + derived data + global keyboard, consumed by every panel
src/App.tsx            shell: Sets picker · panel buttons · export/import · ⚙ · DockviewReact host · status bar
src/panels/            BrowsePanel (Grid/Card/Board + filters) · GraphPanel · DetailPanel · OraclePanel · NavBar
src/components/        CardGrid · CardPanel (collapsible per-context blocks) · BoardView (drag-to-rate) · GraphView ·
                       SetPicker · OptionsModal · SchemeEditor · ContextEditor
src/features.ts        feature flags (community / language / artMode currently off)
```

## Keyboard (global, when not typing)

`←` `→` previous / next in the current filter · `1`–`9` set tier in the first context · `n` focus its notes · `Esc` Card view → Grid

## Not yet (roadmap)

- Deck import (.dek / Moxfield text) → co-occurrence edges (`source: deck`)
- Auto-tags: Scryfall Tagger `otag:` (bulk `oracle_tags`) as first source, rules-text heuristics second, LLM batch offline third
- Chinese card names (Scryfall zhs/zht `printed_name`) + 大學院廢墟 (mtgch) overlay
- Review scorecard (Spearman vs 17lands / vs reviewer aggregates, ±1 tier hit rate) once a set is stable
- File System Access API save into a Syncthing folder (zero-backend dual-machine sync)

## Dev notes (not in the UI)

- Community data sources: `src/api/community/` — 17lands implemented; untapped.gg is a reserved slot (`available: false`) until its API details are known. The whole layer is off via `FEATURES.community`.
- Feature flags (`src/features.ts`): community off · artMode off (per-card pin still works) · links/graph paused pending design review (counterpart pairs still work) · language on.

## Legal

Unofficial fan project. Not affiliated with, endorsed, sponsored, or approved by Wizards of the Coast. Magic: The Gathering
and card names, text and images are © Wizards of the Coast LLC. Card data and images via [Scryfall](https://scryfall.com),
Chinese data via [大學院廢墟](https://mtgch.com). MIT licensed — see LICENSE.

## Privacy

Everything you enter stays in your browser's IndexedDB. The extension makes network requests only to api.scryfall.com /
cards.scryfall.io (card data & images), mtgch.com (Chinese card data, only when card language = 中文), tagger.scryfall.com
(only with the experimental Tagger option on), and raw.githubusercontent.com (version check). No analytics, no accounts.
