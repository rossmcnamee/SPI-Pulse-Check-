import { startOfWeek, subWeeks, format } from 'date-fns'
import type { AdRow, Channel, NewPatientRow } from '../types'

// =============================================================================
// Bundled SAMPLE DATA so the dashboard renders on first load (no upload needed).
// Generated deterministically (seeded RNG) for stable, realistic-looking numbers.
//   • 12 weeks of weekly new-patient rows per location, ~60/wk -> trending up.
//   • Weekly ad rows for 7 Google + 3 Meta + 2 YouTube campaigns.
// Replace by dropping a CSV onto either dataset (see data/store.ts).
// =============================================================================

const ANCHOR_TODAY = new Date('2026-06-10') // matches the app's "today"
const WEEKS = 12
const WEEK_OPTS = { weekStartsOn: 1 as const }

// Mulberry32 — tiny deterministic PRNG so sample data is identical every run.
function makeRng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Monday ISO dates for the 12-week window (oldest -> newest).
function weekDates(): string[] {
  const currentMonday = startOfWeek(ANCHOR_TODAY, WEEK_OPTS)
  return Array.from({ length: WEEKS }, (_, i) =>
    format(subWeeks(currentMonday, WEEKS - 1 - i), 'yyyy-MM-dd'),
  )
}

// ---------------------------------------------------------------------------
// New patients: combined ~58/wk climbing to ~78/wk, split ~54% D2 / 46% D7.
// ---------------------------------------------------------------------------
function buildNewPatients(): NewPatientRow[] {
  const rng = makeRng(101)
  const rows: NewPatientRow[] = []
  weekDates().forEach((date, i) => {
    const base = 58 + i * 1.7 + (rng() * 6 - 3) // gentle upward trend + noise
    const combined = Math.round(base)
    const d2Share = 0.54 + (rng() * 0.06 - 0.03)
    const d2 = Math.round(combined * d2Share)
    const d7 = combined - d2
    rows.push({ date, location: 'D2', count: d2 })
    rows.push({ date, location: 'D7', count: d7 })
  })
  return rows
}

// ---------------------------------------------------------------------------
// Ad campaigns. Each has a weekly spend base + efficiency knobs; weekly figures
// are derived from spend (clicks = spend/cpc, impressions = clicks/ctr, etc.).
// `decay` < 0 makes a campaign get LESS efficient over time (drives the AI
// "spend rose while conversions fell" flag honestly from the data).
// ---------------------------------------------------------------------------
interface CampaignSpec {
  channel: Channel
  campaign: string
  weeklySpend: number // €, week-0 baseline
  spendGrowth: number // €/week added
  cpc: number // € cost per click
  ctr: number // click-through rate (decimal)
  cvr: number // conversion rate of clicks (decimal)
  cvrDrift: number // per-week change to cvr (efficiency trend)
}

const CAMPAIGNS: CampaignSpec[] = [
  // Google (7)
  { channel: 'google', campaign: 'Plantar Fasciitis Search', weeklySpend: 300, spendGrowth: 8, cpc: 2.6, ctr: 0.055, cvr: 0.09, cvrDrift: 0.0015 },
  { channel: 'google', campaign: 'Sports Injury Search', weeklySpend: 420, spendGrowth: 12, cpc: 3.1, ctr: 0.048, cvr: 0.085, cvrDrift: 0.001 },
  { channel: 'google', campaign: 'Back Pain Search', weeklySpend: 260, spendGrowth: 6, cpc: 2.8, ctr: 0.05, cvr: 0.08, cvrDrift: 0.0008 },
  { channel: 'google', campaign: 'Knee Rehab Search', weeklySpend: 180, spendGrowth: 14, cpc: 2.4, ctr: 0.045, cvr: 0.1, cvrDrift: -0.004 }, // degrading
  { channel: 'google', campaign: 'Brand Search', weeklySpend: 90, spendGrowth: 2, cpc: 1.1, ctr: 0.09, cvr: 0.16, cvrDrift: 0.0005 },
  { channel: 'google', campaign: 'Physio Near Me', weeklySpend: 240, spendGrowth: 7, cpc: 2.2, ctr: 0.052, cvr: 0.095, cvrDrift: 0.0012 },
  { channel: 'google', campaign: 'Performance Max', weeklySpend: 150, spendGrowth: 9, cpc: 1.6, ctr: 0.03, cvr: 0.06, cvrDrift: 0.0006 },
  // Meta (3)
  { channel: 'meta', campaign: 'Sports Injury Lead Gen', weeklySpend: 280, spendGrowth: 6, cpc: 1.3, ctr: 0.032, cvr: 0.07, cvrDrift: 0.001 },
  { channel: 'meta', campaign: 'Running Clinic Promo', weeklySpend: 160, spendGrowth: 4, cpc: 1.1, ctr: 0.028, cvr: 0.06, cvrDrift: 0.0008 },
  { channel: 'meta', campaign: 'Retargeting – Site Visitors', weeklySpend: 120, spendGrowth: 3, cpc: 0.9, ctr: 0.045, cvr: 0.11, cvrDrift: -0.0025 }, // degrading
  // YouTube (2)
  { channel: 'youtube', campaign: 'Pre-Season Conditioning', weeklySpend: 180, spendGrowth: 5, cpc: 0.7, ctr: 0.025, cvr: 0.04, cvrDrift: 0.0006 },
  { channel: 'youtube', campaign: 'Clinic Brand Awareness', weeklySpend: 120, spendGrowth: 3, cpc: 0.55, ctr: 0.022, cvr: 0.035, cvrDrift: 0.0004 },
]

function buildAdRows(): AdRow[] {
  const rng = makeRng(202)
  const rows: AdRow[] = []
  const dates = weekDates()
  CAMPAIGNS.forEach((c) => {
    dates.forEach((date, i) => {
      const noise = () => 1 + (rng() * 0.16 - 0.08) // ±8%
      const spend = (c.weeklySpend + c.spendGrowth * i) * noise()
      const cpc = c.cpc * noise()
      const ctr = c.ctr * noise()
      const cvr = Math.max(0.01, (c.cvr + c.cvrDrift * i) * noise())
      const clicks = Math.max(1, Math.round(spend / cpc))
      const impressions = Math.max(clicks, Math.round(clicks / ctr))
      const conversions = Math.max(0, Math.round(clicks * cvr))
      rows.push({
        date,
        channel: c.channel,
        campaign: c.campaign,
        spend: Math.round(spend * 100) / 100,
        impressions,
        clicks,
        conversions,
      })
    })
  })
  return rows
}

export const SAMPLE_NEW_PATIENTS: NewPatientRow[] = buildNewPatients()
export const SAMPLE_AD_ROWS: AdRow[] = buildAdRows()
