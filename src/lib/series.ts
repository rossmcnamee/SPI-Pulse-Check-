import type { AdRow, NewPatientRow } from '../types'
import { weekStart } from './dates'
import { costPerConversion } from './metrics'

// Build sorted weekly time series from raw rows. Used by the trend charts and
// the weekly table. Weeks are keyed by their Monday (yyyy-MM-dd).

export interface WeeklyPatients {
  week: string
  d2: number
  d7: number
  total: number
}

export function weeklyNewPatients(rows: NewPatientRow[]): WeeklyPatients[] {
  const map = new Map<string, WeeklyPatients>()
  for (const r of rows) {
    const wk = weekStart(r.date)
    const e = map.get(wk) ?? { week: wk, d2: 0, d7: 0, total: 0 }
    if (r.location === 'D2') e.d2 += r.count
    else e.d7 += r.count
    e.total += r.count
    map.set(wk, e)
  }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week))
}

export interface WeeklyAd {
  week: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
  costPerConversion: number
}

export function weeklyAdSeries(rows: AdRow[]): WeeklyAd[] {
  const map = new Map<string, WeeklyAd>()
  for (const r of rows) {
    const wk = weekStart(r.date)
    const e = map.get(wk) ?? { week: wk, spend: 0, impressions: 0, clicks: 0, conversions: 0, costPerConversion: 0 }
    e.spend += r.spend
    e.impressions += r.impressions
    e.clicks += r.clicks
    e.conversions += r.conversions
    map.set(wk, e)
  }
  const out = [...map.values()].sort((a, b) => a.week.localeCompare(b.week))
  for (const e of out) e.costPerConversion = costPerConversion(e.spend, e.conversions)
  return out
}
