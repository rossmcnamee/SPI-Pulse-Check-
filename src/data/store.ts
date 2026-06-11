import { useSyncExternalStore } from 'react'
import type { AdRow, Channel, DateRange, LocationFilter, NewPatientRow } from '../types'
import { inRange } from '../lib/dates'
import { SAMPLE_AD_ROWS, SAMPLE_NEW_PATIENTS } from './sampleData'
import { parseAdRowsCsv, parseNewPatientsCsv } from './csv'

// =============================================================================
// store.ts — the SINGLE data layer. Components never parse CSV or touch
// localStorage directly; they call the typed selectors below.
//
// To swap in a real API/Google Sheet later: replace the load/persist internals
// and keep the selector signatures (getNewPatients / getAdMetrics) identical.
// =============================================================================

const LS_KEYS = {
  newPatients: 'spi.newPatients.v1',
  adRows: 'spi.adRows.v1',
  meta: 'spi.meta.v1',
} as const

export type DatasetId = 'newPatients' | 'adRows'

export interface DatasetMeta {
  source: 'sample' | 'upload' | 'live'
  fileName?: string
  updatedAt?: string // ISO timestamp
  rows: number
}

interface StoreState {
  newPatients: NewPatientRow[]
  adRows: AdRow[]
  meta: Record<DatasetId, DatasetMeta>
}

function loadJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function initState(): StoreState {
  const np = loadJSON<NewPatientRow[]>(LS_KEYS.newPatients)
  const ad = loadJSON<AdRow[]>(LS_KEYS.adRows)
  const meta = loadJSON<Record<DatasetId, DatasetMeta>>(LS_KEYS.meta)
  return {
    newPatients: np ?? SAMPLE_NEW_PATIENTS,
    adRows: ad ?? SAMPLE_AD_ROWS,
    meta: meta ?? {
      newPatients: { source: 'sample', rows: SAMPLE_NEW_PATIENTS.length },
      adRows: { source: 'sample', rows: SAMPLE_AD_ROWS.length },
    },
  }
}

let state: StoreState = initState()
let version = 0
const listeners = new Set<() => void>()

function emit() {
  version++
  for (const l of listeners) l()
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// --- Mutations (persist + notify) -------------------------------------------

// Replace a dataset from an uploaded CSV file. Throws CsvError on bad data.
export async function ingestCsv(id: DatasetId, file: File): Promise<void> {
  const text = await file.text()
  if (id === 'newPatients') {
    const rows = parseNewPatientsCsv(text)
    state = { ...state, newPatients: rows }
    localStorage.setItem(LS_KEYS.newPatients, JSON.stringify(rows))
  } else {
    const rows = parseAdRowsCsv(text)
    state = { ...state, adRows: rows }
    localStorage.setItem(LS_KEYS.adRows, JSON.stringify(rows))
  }
  state.meta = {
    ...state.meta,
    [id]: { source: 'upload', fileName: file.name, updatedAt: new Date().toISOString(), rows: count(id) },
  }
  localStorage.setItem(LS_KEYS.meta, JSON.stringify(state.meta))
  emit()
}

// Revert a dataset to the bundled sample data.
export function resetDataset(id: DatasetId): void {
  if (id === 'newPatients') {
    state = { ...state, newPatients: SAMPLE_NEW_PATIENTS }
    localStorage.removeItem(LS_KEYS.newPatients)
  } else {
    state = { ...state, adRows: SAMPLE_AD_ROWS }
    localStorage.removeItem(LS_KEYS.adRows)
  }
  state.meta = { ...state.meta, [id]: { source: 'sample', rows: count(id) } }
  localStorage.setItem(LS_KEYS.meta, JSON.stringify(state.meta))
  emit()
}

function count(id: DatasetId): number {
  return id === 'newPatients' ? state.newPatients.length : state.adRows.length
}

// --- Live data (Cliniko, via the local /api dev endpoint) -------------------
// Fetches real new-patient rows and uses them in place of the sample data.
// An explicit CSV upload takes precedence (the user chose it); otherwise live
// wins over sample. Failures are silent — the dashboard keeps its current data.

const LIVE = { newPatientsLoading: false, adRowsLoading: false }

export function isLiveLoading(id?: DatasetId): boolean {
  if (id === 'adRows') return LIVE.adRowsLoading
  if (id === 'newPatients') return LIVE.newPatientsLoading
  return LIVE.newPatientsLoading || LIVE.adRowsLoading
}

function isNewPatientRows(x: unknown): x is NewPatientRow[] {
  return (
    Array.isArray(x) &&
    x.length > 0 &&
    x.every(
      (r) =>
        r && typeof r === 'object' &&
        typeof (r as NewPatientRow).date === 'string' &&
        ((r as NewPatientRow).location === 'D2' || (r as NewPatientRow).location === 'D7') &&
        typeof (r as NewPatientRow).count === 'number',
    )
  )
}

const AD_CHANNELS = new Set<Channel>(['google', 'meta', 'youtube'])

function isAdRows(x: unknown): x is AdRow[] {
  return (
    Array.isArray(x) &&
    x.length > 0 &&
    x.every(
      (r) =>
        r && typeof r === 'object' &&
        typeof (r as AdRow).date === 'string' &&
        AD_CHANNELS.has((r as AdRow).channel) &&
        typeof (r as AdRow).campaign === 'string' &&
        typeof (r as AdRow).spend === 'number' &&
        typeof (r as AdRow).conversions === 'number',
    )
  )
}

export async function refreshLiveNewPatients(force = false): Promise<void> {
  // Respect an explicit upload unless the user forces a live refresh.
  if (state.meta.newPatients.source === 'upload' && !force) return
  LIVE.newPatientsLoading = true
  emit()
  try {
    const res = await fetch(`/api/new-patients${force ? '?refresh=1' : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows: unknown = await res.json()
    if (!isNewPatientRows(rows)) throw new Error('Unexpected response shape')
    state = { ...state, newPatients: rows }
    localStorage.setItem(LS_KEYS.newPatients, JSON.stringify(rows))
    state.meta = {
      ...state.meta,
      newPatients: { source: 'live', rows: rows.length, updatedAt: new Date().toISOString() },
    }
    localStorage.setItem(LS_KEYS.meta, JSON.stringify(state.meta))
  } catch {
    // Keep whatever data we already have (cached live, or sample).
  } finally {
    LIVE.newPatientsLoading = false
    emit()
  }
}

// Pull live ad rows (Google + Meta + YouTube) from the local /api/ad-rows endpoint.
// Same precedence as new patients: an explicit CSV upload wins; otherwise live
// replaces sample. Failures are silent — the dashboard keeps its current data.
export async function refreshLiveAdRows(force = false): Promise<void> {
  if (state.meta.adRows.source === 'upload' && !force) return
  LIVE.adRowsLoading = true
  emit()
  try {
    const res = await fetch(`/api/ad-rows${force ? '?refresh=1' : ''}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows: unknown = await res.json()
    if (!isAdRows(rows)) throw new Error('Unexpected response shape')
    state = { ...state, adRows: rows }
    localStorage.setItem(LS_KEYS.adRows, JSON.stringify(rows))
    state.meta = {
      ...state.meta,
      adRows: { source: 'live', rows: rows.length, updatedAt: new Date().toISOString() },
    }
    localStorage.setItem(LS_KEYS.meta, JSON.stringify(state.meta))
  } catch {
    // Keep whatever data we already have (cached live, or sample).
  } finally {
    LIVE.adRowsLoading = false
    emit()
  }
}

// Pull live data once on startup (fire-and-forget; cached results render instantly).
void refreshLiveNewPatients()
void refreshLiveAdRows()

// --- Selectors (read-only, typed) -------------------------------------------

export function getNewPatients(range: DateRange, location: LocationFilter): NewPatientRow[] {
  return state.newPatients.filter(
    (r) => inRange(r.date, range) && (location === 'all' || r.location === location),
  )
}

export function getAdMetrics(
  range: DateRange,
  channel?: Channel,
  campaign?: string, // undefined / 'all' => every campaign
): AdRow[] {
  return state.adRows.filter(
    (r) =>
      inRange(r.date, range) &&
      (!channel || r.channel === channel) &&
      (!campaign || campaign === 'all' || r.campaign === campaign),
  )
}

// Distinct campaigns for a channel (data driven — never hard-coded).
export function getCampaigns(channel: Channel): string[] {
  const set = new Set<string>()
  for (const r of state.adRows) if (r.channel === channel) set.add(r.campaign)
  return [...set].sort()
}

export function getChannels(): Channel[] {
  const set = new Set<Channel>()
  for (const r of state.adRows) set.add(r.channel)
  return [...set]
}

export function getMeta(id: DatasetId): DatasetMeta {
  return state.meta[id]
}

// --- React binding -----------------------------------------------------------

// Re-render subscribers whenever any dataset changes (upload / reset).
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
