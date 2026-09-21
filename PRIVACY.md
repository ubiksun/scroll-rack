# Scroll Rack — Privacy Policy

_Last updated: 2026-09-21_

Scroll Rack is a browser extension for rating and annotating Magic: The Gathering cards. It is designed so that your data never leaves your browser.

## What the extension stores

Your ratings, notes, tags, card links, rating dimensions, tier schemes and display preferences are stored **locally** in your browser (IndexedDB and `chrome.storage.local`). Cached card data downloaded from the sources below is stored the same way. Nothing is sent to the developer or to any server operated by the developer.

## Network requests the extension makes

The extension only contacts the following third-party services, and only for the purpose stated:

| Service | Purpose | When |
|---|---|---|
| api.scryfall.com, cards.scryfall.io | Card data and card images | When you load a set or search |
| mtgch.com, images.mtgch.com (大學院廢墟) | Chinese card names, text and scans | Only when card language is set to 中文 |
| tagger.scryfall.com | Community functional tags | Only when the experimental "Scryfall Tagger" option is enabled |
| raw.githubusercontent.com | A small JSON file with the latest version number | About every 6 hours |

Requests contain only what is needed to identify a card or set (set code, collector number, search text). They never include your ratings, notes or any personal information. Each service's own privacy policy governs what it logs about requests it receives.

## On scryfall.com

The extension adds a panel and badges to scryfall.com pages so you can see and edit your own ratings there. It reads the page only to identify which card is shown. It does not read or transmit anything else from the page and does not run on any other website.

## What the extension does not do

- No accounts, no sign-in.
- No analytics, telemetry, tracking or advertising.
- No collection of personal information, browsing history or data from other websites.
- No selling or sharing of data with third parties.

## Your control

You can export all of your data at any time as a JSON file (**export → JSON backup**) and delete it entirely by uninstalling the extension, which removes its local storage.

## Contact

Questions: open an issue at https://github.com/ubiksun/scroll-rack/issues
