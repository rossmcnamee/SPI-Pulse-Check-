// =============================================================================
// TARGETS CONFIG  —  the single place to adjust new-patient goals.
// The CMO can edit everything in this file without touching any UI code.
//
// UNIT DECISION (confirm before treating as final):
//   The brief listed "June: 260 per week", but the standing North Star is
//   100 NEW PATIENTS PER WEEK, and 260 / month ≈ 60 / week ≈ the current run
//   rate. So all dated targets below are treated as MONTHLY totals.
//   Flip TARGET_UNIT to 'weekly' if these should ever be read as weekly.
// =============================================================================

export type TargetUnit = 'monthly' | 'weekly'

// How the numbers in MONTHLY_TARGETS should be interpreted.
export const TARGET_UNIT: TargetUnit = 'monthly'

// The standing North Star: new patients per week, to be reached by December.
export const NORTH_STAR_WEEKLY = 100

// Average weeks in a month, used to translate monthly targets <-> weekly pace.
export const WEEKS_PER_MONTH = 52 / 12 // ≈ 4.345

// Monthly new-patient targets keyed by ISO month (YYYY-MM).
// `weekly` is the approximate per-week equivalent quoted in the brief, kept
// only for display; the run-rate maths derives its own figure from `monthly`.
export interface MonthlyTarget {
  month: string // YYYY-MM
  label: string
  monthly: number
  approxWeekly: number
}

export const MONTHLY_TARGETS: MonthlyTarget[] = [
  { month: '2026-06', label: 'June', monthly: 260, approxWeekly: 60 },
  { month: '2026-07', label: 'July', monthly: 300, approxWeekly: 69 },
  { month: '2026-08', label: 'August', monthly: 340, approxWeekly: 79 },
  { month: '2026-09', label: 'September', monthly: 390, approxWeekly: 90 },
  { month: '2026-10', label: 'October', monthly: 500, approxWeekly: 115 },
  { month: '2026-11', label: 'November', monthly: 500, approxWeekly: 115 },
  { month: '2026-12', label: 'December', monthly: 500, approxWeekly: 115 },
]

// Look up the monthly target for a given Date (falls back to nearest known).
export function targetForMonth(date: Date): MonthlyTarget {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  const exact = MONTHLY_TARGETS.find((t) => t.month === key)
  if (exact) return exact
  // Before the first / after the last known month, clamp to the nearest.
  if (key < MONTHLY_TARGETS[0].month) return MONTHLY_TARGETS[0]
  return MONTHLY_TARGETS[MONTHLY_TARGETS.length - 1]
}

// The monthly target translated into a weekly pace line.
export function weeklyPaceForMonth(date: Date): number {
  const t = targetForMonth(date)
  return TARGET_UNIT === 'weekly' ? t.monthly : Math.round(t.monthly / WEEKS_PER_MONTH)
}
