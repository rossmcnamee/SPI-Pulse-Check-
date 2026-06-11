import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  subDays,
  differenceInCalendarDays,
  format,
  parseISO,
  isWithinInterval,
} from 'date-fns'
import type { DateRange } from '../types'

// Weeks start Monday for SPI reporting.
const WEEK_OPTS = { weekStartsOn: 1 as const }

// A very wide range, for trend charts that show the full history regardless
// of the selected date filter.
export const FULL_RANGE: DateRange = { start: new Date('2000-01-01'), end: new Date('2100-01-01') }

export type PresetKey = 'last7' | 'thisWeek' | 'thisMonth' | 'thisQuarter' | 'custom'

export const PRESET_LABELS: Record<Exclude<PresetKey, 'custom'>, string> = {
  last7: 'Last 7 days',
  thisWeek: 'This week',
  thisMonth: 'This month',
  thisQuarter: 'This quarter',
}

export function rangeForPreset(preset: Exclude<PresetKey, 'custom'>, now: Date): DateRange {
  switch (preset) {
    case 'last7':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) }
    case 'thisWeek':
      return { start: startOfWeek(now, WEEK_OPTS), end: endOfWeek(now, WEEK_OPTS) }
    case 'thisMonth':
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'thisQuarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) }
  }
}

// The equivalent prior period of the same length, immediately before `range`.
export function priorPeriod(range: DateRange): DateRange {
  const days = differenceInCalendarDays(range.end, range.start) + 1
  const end = subDays(range.start, 1)
  const start = subDays(end, days - 1)
  return { start: startOfDay(start), end: endOfDay(end) }
}

export function inRange(iso: string, range: DateRange): boolean {
  const d = parseISO(iso)
  return isWithinInterval(d, { start: startOfDay(range.start), end: endOfDay(range.end) })
}

export function weekStart(iso: string): string {
  return format(startOfWeek(parseISO(iso), WEEK_OPTS), 'yyyy-MM-dd')
}

export function fmtDay(d: Date | string): string {
  const date = typeof d === 'string' ? parseISO(d) : d
  return format(date, 'd MMM')
}

export function fmtRange(range: DateRange): string {
  return `${fmtDay(range.start)} – ${fmtDay(range.end)}`
}

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export { startOfWeek, WEEK_OPTS }
