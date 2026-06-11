// Core domain types. Kept deliberately small; derived values are computed in selectors,
// never stored (see store.ts / lib/metrics).

export type Location = 'D2' | 'D7'
export type LocationFilter = 'all' | Location
export type Channel = 'google' | 'meta' | 'youtube'

export interface NewPatientRow {
  date: string // ISO day, e.g. 2026-06-01 (may be weekly or daily granularity)
  location: Location
  count: number // whole patients only
}

export interface AdRow {
  date: string // ISO day
  channel: Channel
  campaign: string // free text, drives the campaign filter
  spend: number // euro
  impressions: number
  clicks: number
  conversions: number
}

export interface DateRange {
  start: Date // inclusive
  end: Date // inclusive
}

// A computed value plus its week-on-week (period-on-period) comparison.
export interface Trend {
  value: number
  prev: number
  deltaPct: number | null // null when prev is 0 (undefined growth)
  absDelta: number
}

// The trend "meaning" decides what colour an up/down arrow gets.
//  upGood   -> rising is positive (green up, coral down)
//  downGood -> falling is positive (green down, coral up) — e.g. cost per conversion
//  neutral  -> direction shown but always navy — e.g. spend
export type TrendSense = 'upGood' | 'downGood' | 'neutral'
