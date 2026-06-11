import type { TrendSense } from '../types'

// =============================================================================
// METRIC DEFINITIONS  —  documented constants for the CMO.
//
//  • Formulas live in lib/metrics.ts (computed from raw data, never stored).
//  • TREND_SENSE below encodes "up is not always good" (see Section 7):
//      conversions / clicks / impressions / convRate / ctr / newPatients -> up is GOOD
//      costPerConversion -> DOWN is good (cheaper is better)
//      spend -> NEUTRAL (more spend is neither good nor bad on its own)
// =============================================================================

export type MetricKey =
  | 'newPatients'
  | 'spend'
  | 'impressions'
  | 'clicks'
  | 'conversions'
  | 'costPerConversion'
  | 'convRate'
  | 'ctr'

export const TREND_SENSE: Record<MetricKey, TrendSense> = {
  newPatients: 'upGood',
  impressions: 'upGood',
  clicks: 'upGood',
  conversions: 'upGood',
  convRate: 'upGood',
  ctr: 'upGood',
  costPerConversion: 'downGood', // cheaper is better
  spend: 'neutral', // direction shown in navy; AI panel interprets context
}

// -----------------------------------------------------------------------------
// Conversion definitions per channel — CONFIRM with CMO.
// For Meta a conversion is a GrowForm completion (growformCompleted), 1:1.
// Google & YouTube definitions are placeholders to be confirmed.
// -----------------------------------------------------------------------------
export const CONVERSION_DEFINITIONS: Record<string, string> = {
  meta: 'GrowForm completion (growformCompleted), counted 1:1.',
  google: 'TODO confirm: Google Ads conversion action (e.g. booking form submit / call).',
  youtube: 'TODO confirm: YouTube conversion action (e.g. landing-page lead).',
}

// New-patient definition — CONFIRM counting point with CMO.
export const NEW_PATIENT_DEFINITION =
  'A first-ever PAID appointment at SPI (not a returning client). Dublin 2 and Dublin 7 ' +
  'combine into the single headline number.'

// Whether a new patient is counted at booking or at attendance — CONFIRM.
export const NEW_PATIENT_COUNT_POINT: 'booking' | 'attendance' = 'booking'
