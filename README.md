# Scroll Rack (Chrome extension)

Your personal card-knowledge layer for MTG: rate every card per **context** (Limited / Constructed / …, each with its own
tier scheme), keep notes, **tag** cards, **link** cards into an Obsidian-style graph, overlay **17lands** data — in a grader
tab AND directly on **scryfall.com** (floating panel on card pages, tier badges on search grids). Search uses Scryfall's
own syntax (proxied to the API).

## Install (users)

- **Chrome Web Store** — coming soon (unlisted beta first).
- **Zip** — grab `scroll-rack-vX.Y.Z.zip` from [Releases](https://github.com/ubiksun/scroll-rack/releases), unzip it
  somewhere permanent, then Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → pick the unzipped folder.
  To upgrade, unzip the new version over the same folder and hit ↻ on the extension card — your data lives in Chrome's
  profile, not in the folder. Full steps in `release/INSTALL.md`.

## Build (developers)

```
npm install
npm run build        # → dist/  (this is the folder you load unpacked)
npm run watch        # rebuild on change; then ↻ the extension card
```

Quick UI preview without loading the extension: `npx vite preview --host 127.0.0.1 --port 4173`. Everything works except
the parts that need `chrome.*` (the scryfall.com overlay, the Tagger option, the version check).

Release: bump `version` in `public/manifest.json` → `scripts/release.sh "notes"` → see `release/PUBLISH.md`.

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

| Path | What it is |
|---|---|
| `public/manifest.json` | MV3 manifest — see PUBLISH.md for the permission rationale |
| `public/_locales/` | Chrome i18n for the manifest strings (en · zh_CN · zh_TW) |
| `public/content.css` | styles for the scryfall.com overlay |
| `public/icons/` | 16 / 32 / 48 / 128 icons, rendered from `scripts/icon-final.jpeg` |
| `src/main.tsx` · `App.tsx` | app page entry and shell (header, dock layout, status bar, update banner) |
| `src/background.ts` | service worker: opens the app tab, answers content-script messages against the DB, proxies Tagger |
| `src/content.ts` | scryfall.com content script: card-page panel, badges on card images (no imports — plain script) |
| `src/messages.ts` | message types between content script and background |
| `src/state.tsx` | `GraderProvider` — all app state, filters, sort, search, language layer, keyboard |
| `src/db.ts` | Dexie schema (v6): sets · cards · ratings · contexts · schemes · cardTags · edges · artPrefs · zh · settings; export/import; Echoverse pairing |
| `src/features.ts` | feature flags (community off · links paused · artMode off · language on) |
| `src/i18n.ts` | UI strings EN / 中文 |
| `src/update.ts` | version check against `release/latest.json` on GitHub |
| `src/export.ts` | JSON · CSV · Markdown/Obsidian · decklist · graph JSON |
| `src/api/scryfall.ts` | set list, full-set pull (all printings, grouped by oracle_id), global search, 429 backoff |
| `src/api/search.ts` | Scryfall-syntax search scoped to the active sets |
| `src/api/formats.ts` | Standard / Pioneer / Modern grouping for the Sets menu |
| `src/api/mtgch.ts` | 大學院廢墟 API: Chinese names, text, scans |
| `src/api/tagger.ts` | Scryfall Tagger community tags (experimental) |
| `src/api/seventeen.ts` · `api/community/` | 17lands + data-source abstraction (untapped.gg reserved); layer currently off |
| `src/panels/` | dock panels: Browse (Grid / Card / Board) · Card · Oracle · Graph (hidden) · NavBar |
| `src/components/` | CardGrid · CardPanel · BoardView · ArtPicker · SetPicker · SortMenu · OptionsModal · TagTable · SchemeEditor · GraphView |
| `scripts/release.sh` | build → side-load zip + store zip + latest.json |
| `release/` | INSTALL.md (testers) · PUBLISH.md (store + release procedure) · latest.json |
| `PRIVACY.md` | privacy policy linked from the store listing |

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
