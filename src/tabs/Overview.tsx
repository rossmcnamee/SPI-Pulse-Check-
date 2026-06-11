import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Star } from 'lucide-react'
import { useApp, TODAY } from '../state/AppContext'
import { getAdMetrics, getNewPatients, getChannels } from '../data/store'
import { FULL_RANGE, fmtDay, priorPeriod, inRange } from '../lib/dates'
import { weeklyNewPatients } from '../lib/series'
import { makeTrend, sumAdRows } from '../lib/metrics'
import { NORTH_STAR_WEEKLY, targetForMonth, weeklyPaceForMonth } from '../config/targets'
import { fmtEur, fmtInt, fmtPct } from '../lib/format'
import { Card } from '../components/Card'
import { ChartCard } from '../components/ChartCard'
import { TrendBadge } from '../components/TrendBadge'
import { Sparkline } from '../components/Sparkline'
import { EmptyState } from '../components/EmptyState'
import type { Channel } from '../types'
import { startOfMonth } from 'date-fns'

const CHANNEL_LABEL: Record<Channel, string> = { google: 'Google Ads', meta: 'Meta Ads', youtube: 'YouTube Ads' }
const CHANNEL_ORDER: Channel[] = ['google', 'meta', 'youtube']

export function Overview() {
  const { range, location } = useApp()

  // Full weekly history (respecting location) for the North Star + trend chart.
  const weekly = useMemo(() => weeklyNewPatients(getNewPatients(FULL_RANGE, location)), [location])

  // North Star = the most recent week within the selected range, vs the week before.
  const idx = useMemo(() => {
    let last = -1
    weekly.forEach((w, i) => {
      if (inRange(w.week, range)) last = i
    })
    return last === -1 ? weekly.length - 1 : last
  }, [weekly, range])

  const thisWeek = weekly[idx]
  const lastWeek = weekly[idx - 1]
  const weekTrend = makeTrend(thisWeek?.total ?? 0, lastWeek?.total ?? 0)
  const weeklyProgress = thisWeek ? (thisWeek.total / NORTH_STAR_WEEKLY) * 100 : 0

  // Monthly progress toward this month's target (month of the range end).
  const monthAnchor = range.end < TODAY ? range.end : TODAY
  const monthTarget = targetForMonth(monthAnchor)
  const monthStart = startOfMonth(monthAnchor)
  const monthToDate = weekly
    .filter((w) => new Date(w.week) >= monthStart && new Date(w.week) <= monthAnchor)
    .reduce((s, w) => s + w.total, 0)
  const monthPct = Math.min(100, (monthToDate / monthTarget.monthly) * 100)
  const paceLine = weeklyPaceForMonth(monthAnchor)

  return (
    <div className="space-y-6">
      {/* North Star */}
      <Card accent className="overflow-hidden">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="lg:w-1/2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-gold">
              <Star size={12} /> North Star · New patients this week
            </div>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-6xl font-extrabold tabular-nums text-navy">{thisWeek?.total ?? 0}</span>
              <span className="mb-1.5 text-lg font-semibold text-muted">/ {NORTH_STAR_WEEKLY}</span>
              {thisWeek && <TrendBadge trend={weekTrend} sense="upGood" suffix="vs last week" className="mb-2" />}
            </div>
            <p className="mt-1 text-sm text-muted">
              {fmtPct(weeklyProgress, 0)} of the 100/week North Star · week of {thisWeek ? fmtDay(thisWeek.week) : '—'}
            </p>
          </div>

          {/* Monthly progress bar */}
          <div className="lg:w-1/2">
            <div className="flex items-center justify-between text-xs">
              <span className="kpi-label">{monthTarget.label} target</span>
              <span className="font-semibold text-navy">
                {fmtInt(monthToDate)} / {fmtInt(monthTarget.monthly)}
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-bg">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${monthPct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {fmtPct(monthPct, 0)} of {monthTarget.label}’s monthly goal · pace needed ≈ {paceLine}/week
            </p>
          </div>
        </div>
      </Card>

      {/* Channel pulse */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CHANNEL_ORDER.filter((c) => getChannels().includes(c)).map((ch) => (
          <ChannelPulse key={ch} channel={ch} />
        ))}
      </div>

      {/* New patients trend */}
      <NewPatientsTrend weekly={weekly} paceLine={paceLine} paceLabel={monthTarget.label} />
    </div>
  )
}

function ChannelPulse({ channel }: { channel: Channel }) {
  const { range } = useApp()
  const cur = sumAdRows(getAdMetrics(range, channel))
  const prev = sumAdRows(getAdMetrics(priorPeriod(range), channel))
  const convTrend = makeTrend(cur.conversions, prev.conversions)
  const spendTrend = makeTrend(cur.spend, prev.spend)

  // Sparkline of conversions across the (full) weekly history for this channel.
  const spark = useMemo(() => {
    const rows = getAdMetrics(FULL_RANGE, channel)
    const byWeek = new Map<string, number>()
    for (const r of rows) {
      const wk = r.date.slice(0, 10)
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + r.conversions)
    }
    return [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
  }, [channel])

  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-navy">{CHANNEL_LABEL[channel]}</span>
        <TrendBadge trend={convTrend} sense="upGood" />
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="kpi-label">Conversions</div>
          <div className="text-3xl font-bold tabular-nums text-navy">{fmtInt(cur.conversions)}</div>
        </div>
        <div className="h-9 w-24">
          <Sparkline data={spark.length ? spark : [0, 0]} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
        <div>
          <div className="kpi-label">Spend</div>
          <div className="text-sm font-semibold tabular-nums text-navy">{fmtEur(cur.spend)}</div>
        </div>
        {/* Spend trend is neutral navy by design (Section 7). */}
        <TrendBadge trend={spendTrend} sense="neutral" suffix="" />
      </div>
    </Card>
  )
}

function NewPatientsTrend({
  weekly,
  paceLine,
  paceLabel,
}: {
  weekly: { week: string; total: number }[]
  paceLine: number
  paceLabel: string
}) {
  const data = weekly.map((w) => ({ ...w, label: fmtDay(w.week) }))
  // Vertical guides at the first chart-week of each month.
  const monthMarks = useMemo(() => {
    const seen = new Set<string>()
    const marks: { label: string; month: string }[] = []
    for (const w of weekly) {
      const m = w.week.slice(0, 7)
      if (!seen.has(m)) {
        seen.add(m)
        marks.push({ label: fmtDay(w.week), month: m })
      }
    }
    return marks
  }, [weekly])

  if (!weekly.length) return <ChartCard title="New patients trend"><EmptyState /></ChartCard>

  return (
    <ChartCard
      title="New patients trend"
      subtitle={`Weekly new patients · North Star 100/wk (gold) · ${paceLabel} pace ${paceLine}/wk (navy dashed)`}
    >
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="newPatientsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14365C" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#14365C" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ECEEF2" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7280' }} tickLine={false} axisLine={false} />
          {/* Headroom so the gold North Star line at 100 is always visible. */}
          <YAxis
            tick={{ fontSize: 11, fill: '#6B7280' }}
            tickLine={false}
            axisLine={false}
            domain={[0, (max: number) => Math.max(110, Math.ceil((max * 1.1) / 10) * 10)]}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #ECEEF2', fontSize: 12 }}
            formatter={(v: number) => [v, 'New patients']}
          />
          {monthMarks.map((m) => (
            <ReferenceLine key={m.month} x={m.label} stroke="#ECEEF2" strokeWidth={1} />
          ))}
          <ReferenceLine y={100} stroke="#F5A623" strokeWidth={2} strokeDasharray="4 4" />
          <ReferenceLine y={paceLine} stroke="#14365C" strokeWidth={1.5} strokeDasharray="5 5" />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#14365C"
            strokeWidth={2.5}
            fill="url(#newPatientsFill)"
            dot={{ r: 3, fill: '#14365C', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#14365C', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
