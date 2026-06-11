import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { DateRange, LocationFilter } from '../types'
import { rangeForPreset, type PresetKey } from '../lib/dates'

// Global controls shared by every tab: location toggle + date filter.
// Default location = All, default preset = This month (Section 4).

export type TabId = 'overview' | 'newPatients' | 'paidAds'

// The app's notion of "today" (matches the bundled sample data window).
export const TODAY = new Date('2026-06-10')

interface AppState {
  tab: TabId
  setTab: (t: TabId) => void
  location: LocationFilter
  setLocation: (l: LocationFilter) => void
  preset: PresetKey
  setPreset: (p: PresetKey) => void
  range: DateRange
  setCustomRange: (r: DateRange) => void
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<TabId>('overview')
  const [location, setLocation] = useState<LocationFilter>('all')
  const [preset, setPreset] = useState<PresetKey>('thisMonth')
  const [customRange, setCustomRange] = useState<DateRange>(() => rangeForPreset('thisMonth', TODAY))

  const range = useMemo<DateRange>(
    () => (preset === 'custom' ? customRange : rangeForPreset(preset, TODAY)),
    [preset, customRange],
  )

  const value: AppState = {
    tab,
    setTab,
    location,
    setLocation,
    preset,
    setPreset,
    range,
    setCustomRange: (r) => {
      setCustomRange(r)
      setPreset('custom')
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
