# Scroll Rack (Chrome extension)

**Scroll Rack is a browser extension for rating and annotating Magic: The Gathering cards.**

Rate every card on as many **comments** as you like (Limited / Constructed / …, each with its own tier ladder), keep
notes, **tag** cards, **link** cards into an Obsidian-style graph — in an app tab AND directly on **scryfall.com**
(floating panel on card pages, tier badges on search grids). Search uses Scryfall's own syntax (proxied to the API).

## Install

**[Get it on the Chrome Web Store](https://chromewebstore.google.com/detail/scroll-rack/oejlhhgcahmkcocomlkocjccnandkmdp)** — one click, auto-updating.

**Or from GitHub** — download `scroll-rack-vX.Y.Z.zip` from [Releases](https://github.com/ubiksun/scroll-rack/releases),
unzip it somewhere permanent, then open `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → pick
the unzipped folder. To update, unzip the newer version over the same folder and hit ↻ on the extension card. Your
ratings and notes live in Chrome's profile, not in that folder, so they survive the overwrite.

## Roadmap

- Auto-tags: Scryfall Tagger `otag:` (bulk `oracle_tags`) as first source, rules-text heuristics second, LLM batch offline third
- 大學院廢墟 (mtgch) overlay
- Review scorecard (Spearman vs 17lands / vs reviewer aggregates, ±1 tier hit rate) once a set is stable

## Legal

Unofficial fan project. Not affiliated with, endorsed, sponsored, or approved by Wizards of the Coast. Magic: The Gathering
and card names, text and images are © Wizards of the Coast LLC. Card data and images via [Scryfall](https://scryfall.com),
Chinese data via [大學院廢墟](https://mtgch.com). MIT licensed — see LICENSE.

## Privacy

Everything you enter stays in your browser's IndexedDB. The extension makes network requests only to api.scryfall.com /
cards.scryfall.io (card data & images), mtgch.com (Chinese card data, only when card language = 中文), tagger.scryfall.com
(only with the experimental Tagger option on), and raw.githubusercontent.com (version check). No analytics, no accounts.
