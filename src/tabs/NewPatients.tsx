import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts'
import { useApp, TODAY } from '../state/AppContext'
import { getNewPatients } from '../data/store'
import { FULL_RANGE, fmtDay, priorPeriod, inRange } from '../lib/dates'
import { weeklyNewPatients } from '../lib/series'
import { makeTrend } from '../lib/metrics'
import { targetForMonth, weeklyPaceForMonth } from '../config/targets'
import { fmtInt, fmtPct } from '../lib/format'
import { KpiCard } from '../components/KpiCard'
import { ChartCard } from '../components/ChartCard'
import { EmptyState } from '../components/EmptyState'
import { TrendBadge } from '../components/TrendBadge'
import { startOfMonth } from 'date-fns'

export function NewPatients() {
  const { range, location } = useApp()
  const single = location !== 'all'

  const inRangeRows = useMemo(() => getNewPatients(range, location), [range, location])
  const priorRows = useMemo(() => getNewPatients(priorPeriod(range), location), [range, location])
  const weeklyAll = useMemo(() => weeklyNewPatients(getNewPatients(FULL_RANGE, location)), [location])
  const weeklyInRange = useMemo(() => weeklyAll.filter((w) => inRange(w.week, range)), [weeklyAll, range])

  const total = inRangeRows.reduce((s, r) => s + r.count, 0)
  const priorTotal = priorRows.reduce((s, r) => s + r.count, 0)
  const totalTrend = makeTrend(total, priorTotal)
  const weeksCount = Math.max(1, weeklyInRange.length)
  const weeklyAvg = total / weeksCount

  const monthAnchor = range.end < TODAY ? range.end : TODAY
  const monthTarget = targetForMonth(monthAnchor)
  const monthStart = startOfMonth(monthAnchor)
  const monthToDate = weeklyAll
    .filter((w) => new Date(w.week) >= monthStart && new Date(w.week) <= monthAnchor)
    .reduce((s, w) => s + w.total, 0)
  const monthPct = Math.min(100, (monthToDate / monthTarget.monthly) * 100)
  const pace = weeklyPaceForMonth(monthAnchor)

  // Donut split for the range.
  const d2 = inRangeRows.filter((r) => r.location === 'D2').reduce((s, r) => s + r.count, 0)
  const d7 = inRangeRows.filter((r) => r.location === 'D7').reduce((s, r) => s + r.count, 0)

  if (!inRangeRows.length) {
    return <EmptyState message="No new-patient data for this range." hint="Try a wider date range or upload a CSV." />
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total new patients" value={fmtInt(total)} trend={totalTrend} sense="upGood" sub="vs prior period" />
        <KpiCard label="Weekly average" value={weeklyAvg.toFixed(1)} sub={`${weeksCount} week${weeksCount > 1 ? 's' : ''} in range`} />
        <KpiCard
          label="Change vs prior"
          value={<span className="tabular-nums">{totalTrend.absDelta >= 0 ? '+' : '−'}{Math.abs(totalTrend.absDelta)}</span>}
          trend={totalTrend}
          sense="upGood"
        />
        <KpiCard
          label={`${monthTarget.label} target progress`}
          value={fmtPct(monthPct, 0)}
          sub={`${fmtInt(monthToDate)} / ${fmtInt(monthTarget.monthly)}`}
        />
      </div>

      {/* Location split */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard
          title={single ? `New patients over time · ${location}` : 'Location split over time'}
          subtitle={single ? 'Single location selected' : 'Dublin 2 vs Dublin 7, weekly'}
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weeklyAll.map((w) => ({ ...w, label: fmtDay(w.week) }))} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#ECEEF2" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #ECEEF2', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {(!single || location === 'D2') && <Line type="monotone" dataKey="d2" name="Dublin 2" stroke="#14365C" strokeWidth={2.5} dot={false} />}
              {(!single || location === 'D7') && <Line type="monotone" dataKey="d7" name="Dublin 7" stroke="#F5A623" strokeWidth={2.5} dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Share of new patients" subtitle="Selected range">
          {single ? (
            <div className="flex h-[280px] flex-col items-center justify-center text-center">
              <span className="text-5xl font-extrabold text-navy">{fmtInt(total)}</span>
              <span className="mt-2 text-sm text-muted">All from {location} (single location selected)</span>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Dublin 2', value: d2 },
                      { name: 'Dublin 7', value: d7 },
                    ]}
                    dataKey="value"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <Cell fill="#14365C" />
                    <Cell fill="#F5A623" />
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #ECEEF2', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-navy" /> D2 {fmtPct((d2 / (d2 + d7 || 1)) * 100, 0)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-gold" /> D7 {fmtPct((d7 / (d2 + d7 || 1)) * 100, 0)}
                </span>
              </div>
            </>
          )}
        </ChartCard>
      </div>

      {/* Run rate vs target */}
      <ChartCard
        title="Run rate vs target"
        subtitle={`Weekly new patients against ${monthTarget.label}'s monthly target as a weekly pace line (${pace}/wk)`}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={weeklyAll.map((w) => ({ ...w, label: fmtDay(w.week) }))} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="runRateFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14365C" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#14365C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ECEEF2" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #ECEEF2', fontSize: 12 }} formatter={(v: number) => [v, 'New patients']} />
            <ReferenceLine y={pace} stroke="#E5564B" strokeWidth={1.5} strokeDasharray="5 5" label={{ value: `pace ${pace}`, fontSize: 11, fill: '#E5564B', position: 'right' }} />
            <Area type="monotone" dataKey="total" name="New patients" stroke="#14365C" strokeWidth={2.5} fill="url(#runRateFill)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Weekly table */}
      <WeeklyTable weekly={weeklyAll} pace={pace} single={single} location={location} />
    </div>
  )
}

function WeeklyTable({
  weekly,
  pace,
  single,
  location,
}: {
  weekly: { week: string; d2: number; d7: number; total: number }[]
  pace: number
  single: boolean
  location: string
}) {
  // newest first
  const rows = [...weekly].reverse()
  return (
    <ChartCard title="Weekly breakdown" subtitle="Newest first · change vs prior week · pace flag">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-[11px] uppercase tracking-wider text-muted">
              <th className="py-2 pr-4 font-semibold">Week starting</th>
              {(!single || location === 'D2') && <th className="px-2 py-2 text-right font-semibold">D2</th>}
              {(!single || location === 'D7') && <th className="px-2 py-2 text-right font-semibold">D7</th>}
              <th className="px-2 py-2 text-right font-semibold">Total</th>
              <th className="px-2 py-2 text-right font-semibold">vs prior</th>
              <th className="px-2 py-2 text-right font-semibold">Pace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w, i) => {
              const prior = rows[i + 1]
              const trend = makeTrend(w.total, prior?.total ?? 0)
              const onPace = w.total >= pace
              return (
                <tr key={w.week} className="border-b border-hairline/60 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-navy">{fmtDay(w.week)}</td>
                  {(!single || location === 'D2') && <td className="px-2 py-2.5 text-right tabular-nums text-ink">{w.d2}</td>}
                  {(!single || location === 'D7') && <td className="px-2 py-2.5 text-right tabular-nums text-ink">{w.d7}</td>}
                  <td className="px-2 py-2.5 text-right font-semibold tabular-nums text-navy">{w.total}</td>
                  <td className="px-2 py-2.5 text-right">
                    {prior ? <TrendBadge trend={trend} sense="upGood" suffix="" /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        onPace ? 'bg-green/10 text-green' : 'bg-coral/10 text-coral',
                      ].join(' ')}
                    >
                      {onPace ? 'On pace' : 'Behind'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}
