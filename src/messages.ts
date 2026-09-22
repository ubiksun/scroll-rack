// Types shared between the Scryfall content script and the background service worker. Types only — content.ts must
// stay import-free at runtime so it bundles as a plain (non-module) script.
import type { CardTag, Context, Scheme } from './db'

export interface OverlayRating { context: string; tier: string | null; note: string }
export interface OverlayLink { tags: string[]; source: string; name: string; note: string }
export interface OverlayCommunity { gih: number | null; oh: number | null; iwd: number | null; alsa: number | null; ata: number | null; games: number; percentile: number | null; fetchedAt: number }

export interface OverlayCard {
  found: true
  set: string
  oracleId: string
  name: string
  collectorNumber: string
  ratings: OverlayRating[]
  tags: string[]
  links: OverlayLink[]
  community: OverlayCommunity | null
  contexts: Context[]
  schemes: Scheme[]
  activeContext: string
  features: { community: boolean; links: boolean }   // mirrors src/features.ts — the overlay hides what the app hides
}
export interface OverlayMissing { found: false; set: string; setLoaded: boolean }
export type OverlayLookup = OverlayCard | OverlayMissing

import type { BadgeStyle } from './db'
export interface Badge { ctxId: string; ctx: string; tier: string; color: string; style?: BadgeStyle }
export type BadgeMap = Record<string, Badge[]>   // printingId → badges (already filtered by the user's badge prefs)

export type Msg =
  | { type: 'lookup'; set: string; collectorNumber: string }
  | { type: 'badges'; printingIds: string[] }
  | { type: 'badgesForCard'; set: string; collectorNumber: string }
  | { type: 'rate'; set: string; oracleId: string; context: string; tier: string | null }
  | { type: 'note'; set: string; oracleId: string; context: string; note: string }
  | { type: 'tag'; oracleId: string; tag: string; remove?: boolean }
  | { type: 'fetchSet'; set: string }
  | { type: 'openApp' }
  | { type: 'tagger'; set: string; collectorNumber: string; oracleId: string; force?: boolean }

export type _Unused = CardTag
