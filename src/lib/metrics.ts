import type { AdRow, Trend, TrendSense } from '../types'

// -----------------------------------------------------------------------------
// Derived metric formulas (Section 7). Always computed from raw rows.
// -----------------------------------------------------------------------------
export function costPerConversion(spend: number, conversions: number): number {
  return conversions > 0 ? spend / conversions : 0
}
export function convRate(conversions: number, clicks: number): number {
  return clicks > 0 ? (conversions / clicks) * 100 : 0
}
export function ctr(clicks: number, impressions: number): number {
  return impressions > 0 ? (clicks / impressions) * 100 : 0
}

export interface AdTotals {
  spend: number
  impressions: number
  clicks: number
  conversions: number
  costPerConversion: number
  convRate: number
  ctr: number
}

export function sumAdRows(rows: AdRow[]): AdTotals {
  const spend = rows.reduce((s, r) => s + r.spend, 0)
  const impressions = rows.reduce((s, r) => s + r.impressions, 0)
  const clicks = rows.reduce((s, r) => s + r.clicks, 0)
  const conversions = rows.reduce((s, r) => s + r.conversions, 0)
  return {
    spend,
    impressions,
    clicks,
    conversions,
    costPerConversion: costPerConversion(spend, conversions),
    convRate: convRate(conversions, clicks),
    ctr: ctr(clicks, impressions),
  }
}

// Week-on-week (period-on-period) comparison of two scalars.
export function makeTrend(value: number, prev: number): Trend {
  const absDelta = value - prev
  const deltaPct = prev === 0 ? null : (absDelta / prev) * 100
  return { value, prev, deltaPct, absDelta }
}

// -----------------------------------------------------------------------------
// Trend colour resolution — the single source of truth for "up isn't always good".
// Returns a brand colour token name plus the arrow direction.
// -----------------------------------------------------------------------------
export type TrendColor = 'green' | 'coral' | 'navy'
export type ArrowDir = 'up' | 'down' | 'flat'

export function arrowDir(trend: Trend): ArrowDir {
  if (trend.absDelta > 0) return 'up'
  if (trend.absDelta < 0) return 'down'
  return 'flat'
}

export function trendColor(trend: Trend, sense: TrendSense): TrendColor {
  if (sense === 'neutral') return 'navy'
  const dir = arrowDir(trend)
  if (dir === 'flat') return 'navy'
  const rising = dir === 'up'
  const good = sense === 'upGood' ? rising : !rising
  return good ? 'green' : 'coral'
}

export const COLOR_HEX: Record<TrendColor, string> = {
  green: '#3BB54A',
  coral: '#E5564B',
  navy: '#14365C',
}
