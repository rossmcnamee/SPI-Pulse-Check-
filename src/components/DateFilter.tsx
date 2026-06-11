import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { parseISO } from 'date-fns'
import { useApp } from '../state/AppContext'
import { PRESET_LABELS, fmtRange, toISODate, startOfDay, endOfDay, type PresetKey } from '../lib/dates'

const PRESETS: Exclude<PresetKey, 'custom'>[] = ['last7', 'thisWeek', 'thisMonth', 'thisQuarter']

// Preset buttons + a custom range picker. Every metric/chart reads `range`
// from AppContext, and trend comparisons use the equivalent prior period.
export function DateFilter() {
  const { preset, setPreset, range, setCustomRange } = useApp()
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex items-center gap-1">
      {PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => {
            setPreset(p)
            setOpen(false)
          }}
          className={[
            'rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
            preset === p ? 'bg-navy text-white' : 'text-muted hover:bg-bg hover:text-navy',
          ].join(' ')}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
      <button
        onClick={() => setOpen((o) => !o)}
        className={[
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
          preset === 'custom' ? 'bg-navy text-white' : 'text-muted hover:bg-bg hover:text-navy',
        ].join(' ')}
      >
        <CalendarDays size={14} />
        {preset === 'custom' ? fmtRange(range) : 'Custom'}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-64 rounded-xl border border-hairline bg-card p-3 shadow-card">
          <label className="kpi-label">From</label>
          <input
            type="date"
            defaultValue={toISODate(range.start)}
            className="mb-3 mt-1 w-full rounded-lg border border-hairline bg-bg px-2 py-1.5 text-sm text-ink"
            onChange={(e) =>
              e.target.value && setCustomRange({ start: startOfDay(parseISO(e.target.value)), end: range.end })
            }
          />
          <label className="kpi-label">To</label>
          <input
            type="date"
            defaultValue={toISODate(range.end)}
            className="mt-1 w-full rounded-lg border border-hairline bg-bg px-2 py-1.5 text-sm text-ink"
            onChange={(e) =>
              e.target.value && setCustomRange({ start: range.start, end: endOfDay(parseISO(e.target.value)) })
            }
          />
          <button
            onClick={() => setOpen(false)}
            className="mt-3 w-full rounded-lg bg-navy py-1.5 text-xs font-semibold text-white"
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
