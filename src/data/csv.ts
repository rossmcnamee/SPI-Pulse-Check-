import Papa from 'papaparse'
import type { AdRow, Channel, Location, NewPatientRow } from '../types'

// CSV schemas (Section 8) + parsing/validation. Throws CsvError with a friendly
// message on bad input so the UI can surface a clear error state.

export class CsvError extends Error {}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const LOCATIONS: Location[] = ['D2', 'D7']
const CHANNELS: Channel[] = ['google', 'meta', 'youtube']

function parse(text: string): Record<string, string>[] {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })
  if (res.errors.length) {
    throw new CsvError(`Could not parse CSV: ${res.errors[0].message} (row ${res.errors[0].row})`)
  }
  return res.data
}

function requireCols(row: Record<string, string>, cols: string[]) {
  for (const c of cols) {
    if (!(c in row)) throw new CsvError(`Missing required column "${c}". Expected: ${cols.join(', ')}`)
  }
}

function num(v: string, field: string, line: number): number {
  const n = Number(String(v).trim())
  if (!isFinite(n)) throw new CsvError(`Row ${line}: "${field}" must be a number, got "${v}".`)
  return n
}

// new_patients.csv -> date,location,count
export function parseNewPatientsCsv(text: string): NewPatientRow[] {
  const rows = parse(text)
  if (!rows.length) throw new CsvError('CSV has no data rows.')
  requireCols(rows[0], ['date', 'location', 'count'])
  return rows.map((r, i) => {
    const line = i + 2
    if (!ISO_DATE.test(r.date?.trim() ?? '')) throw new CsvError(`Row ${line}: "date" must be YYYY-MM-DD, got "${r.date}".`)
    const location = r.location?.trim().toUpperCase() as Location
    if (!LOCATIONS.includes(location)) throw new CsvError(`Row ${line}: "location" must be D2 or D7, got "${r.location}".`)
    const count = num(r.count, 'count', line)
    if (count < 0 || !Number.isInteger(count)) throw new CsvError(`Row ${line}: "count" must be a whole number ≥ 0.`)
    return { date: r.date.trim(), location, count }
  })
}

// ad_performance.csv -> date,channel,campaign,spend,impressions,clicks,conversions
export function parseAdRowsCsv(text: string): AdRow[] {
  const rows = parse(text)
  if (!rows.length) throw new CsvError('CSV has no data rows.')
  requireCols(rows[0], ['date', 'channel', 'campaign', 'spend', 'impressions', 'clicks', 'conversions'])
  return rows.map((r, i) => {
    const line = i + 2
    if (!ISO_DATE.test(r.date?.trim() ?? '')) throw new CsvError(`Row ${line}: "date" must be YYYY-MM-DD, got "${r.date}".`)
    const channel = r.channel?.trim().toLowerCase() as Channel
    if (!CHANNELS.includes(channel)) throw new CsvError(`Row ${line}: "channel" must be google, meta or youtube, got "${r.channel}".`)
    const campaign = r.campaign?.trim()
    if (!campaign) throw new CsvError(`Row ${line}: "campaign" is required.`)
    return {
      date: r.date.trim(),
      channel,
      campaign,
      spend: num(r.spend, 'spend', line),
      impressions: Math.round(num(r.impressions, 'impressions', line)),
      clicks: Math.round(num(r.clicks, 'clicks', line)),
      conversions: Math.round(num(r.conversions, 'conversions', line)),
    }
  })
}
