// Feature flags for things built but not shipped yet (user decision 2026-09-19 round 2).
export const FEATURES = {
  community: false,   // 17lands overlay — hidden; NOTE: www.17lands.com host permission was removed from manifest, re-add when enabling
  language: true,     // EN/中文 — UI strings + card data from 大學院廢墟 (mtgch)
  artMode: false,     // global regular/alt art switch — per-card pin stays
  links: false,       // v0.7: manual link/graph system paused pending design review; counterpart pairs stay
}
// Runtime (user-toggled) experiments live in settings: 'exp.tagger' (Scryfall Tagger community tags)
