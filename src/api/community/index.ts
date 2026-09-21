// Community / aggregate data sources. Each source turns a set code into per-card metrics keyed by card name, so the UI
// (badges, sort, CSV export, review scorecard) can treat 17lands, untapped.gg, … interchangeably.
// 17lands is implemented in ../seventeen.ts and adapted here; untapped.gg is a reserved slot (see untapped.ts).
export interface CommunityMetric { key: string; label: string; format: (v: number) => string; higherIsBetter: boolean }
export interface CommunityRowG { name: string; metrics: Record<string, number | null>; games?: number }
export interface CommunitySnapshotG { source: string; set: string; format: string; fetchedAt: number; rows: CommunityRowG[] }
export interface CommunitySource {
  id: string
  name: string
  homepage: string
  /** formats this source knows for a set (e.g. PremierDraft / TradDraft) */
  formats: string[]
  metrics: CommunityMetric[]
  /** primary metric used for percentile badges */
  primary: string
  fetchSet(set: string, format?: string): Promise<CommunitySnapshotG>
  /** false while the source is a stub / not configured */
  available: boolean
}

import { seventeenLandsSource } from './seventeen'
import { untappedSource } from './untapped'
export const SOURCES: CommunitySource[] = [seventeenLandsSource, untappedSource]
export const sourceById = (id: string) => SOURCES.find(s => s.id === id)
