import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowDown, ArrowUp, ChevronsUpDown, Sparkles } from 'lucide-react'
import { useApp } from '../state/AppContext'
import { getAdMetrics, getCampaigns, getChannels } from '../data/store'
import { FULL_RANGE, fmtDay, priorPeriod } from '../lib/dates'
import { weeklyAdSeries } from '../lib/series'
import { makeTrend, sumAdRows, type AdTotals } from '../lib/metrics'
import { TREND_SENSE, type MetricKey } from '../config/metrics'
import { fmtEur, fmtInt, fmtPct } from '../lib/format'
import { KpiCard } from '../components/KpiCard'
import { ChartCard } from '../components/ChartCard'
import { Card } from '../components/Card'
import { Segmented } from '../components/Segmented'
import { EmptyState } from '../components/EmptyState'
import { generateChannelSummary } from '../lib/aiOverview'
import type { Channel } from '../types'

const CHANNEL_LABEL: Record<Channel, string> = { google: 'Google', meta: 'Meta', youtube: 'YouTube' }

export function PaidAds() {
  const { range } = useApp()
  const channels = getChannels()
  const [channel, setChannel] = useState<Channel>(channels[0] ?? 'google')
  const [campaign, setCampaign] = useState<string>('all')

  const activeChannel = channels.includes(channel) ? channel : channels[0]
  const campaigns = useMemo(() => getCampaigns(activeChannel), [activeChannel])

  // KPI scope respects the channel + campaign filter + date range.
  const cur = sumAdRows(getAdMetrics(range, activeChannel, campaign))
  const prev = sumAdRows(getAdMetrics(priorPeriod(range), activeChannel, campaign))

  return (
    <div className="space-y-6">
      {/* Channel + campaign selectors */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={channels.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
          value={activeChannel}
          onChange={(c) => {
            setChannel(c)
            setCampaign('all')
          }}
        />
        <div className="flex items-center gap-2">
          <span className="kpi-label">Campaign</span>
          <select
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="rounded-lg border border-hairline bg-card px-3 py-1.5 text-sm font-medium text-navy"
          >
            <option value="all">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <KpiRow cur={cur} prev={prev} scoped={campaign !== 'all'} />

      <CampaignTable channel={activeChannel} />

      <TrendCharts channel={activeChannel} campaign={campaign} />

      <AiPanel channel={activeChannel} />
    </div>
  )
}

// ---- KPI cards (Section 5 order; Spend gets visual weight) ------------------
function KpiRow({ cur, prev, scoped }: { cur: AdTotals; prev: AdTotals; scoped: boolean }) {
  const t = (k: keyof AdTotals) => makeTrend(cur[k] as number, prev[k] as number)
  const sense = (k: MetricKey) => TREND_SENSE[k]
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard label={scoped ? 'Spend (campaign)' : 'Spend'} value={fmtEur(cur.spend)} trend={t('spend')} sense={sense('spend')} emphasis />
      <KpiCard label="Impressions" value={fmtInt(cur.impressions)} trend={t('impressions')} sense={sense('impressions')} />
      <KpiCard label="Clicks" value={fmtInt(cur.clicks)} trend={t('clicks')} sense={sense('clicks')} />
      <KpiCard label={scoped ? 'Conversions (campaign)' : 'Conversions'} value={fmtInt(cur.conversions)} trend={t('conversions')} sense={sense('conversions')} />
      <KpiCard label="Cost / conversion" value={fmtEur(cur.costPerConversion, 2)} trend={t('costPerConversion')} sense={sense('costPerConversion')} />
      <KpiCard label="Conversion rate" value={fmtPct(cur.convRate)} trend={t('convRate')} sense={sense('convRate')} />
      <KpiCard label="Click-through rate" value={fmtPct(cur.ctr, 2)} trend={t('ctr')} sense={sense('ctr')} />
    </div>
  )
}

// ---- Per-campaign sortable table -------------------------------------------
type SortKey = 'campaign' | keyof AdTotals
function CampaignTable({ channel }: { channel: Channel }) {
  const { range } = useApp()
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'spend', dir: 'desc' })

  const rows = useMemo(() => {
    return getCampaigns(channel).map((name) => ({ name, totals: sumAdRows(getAdMetrics(range, channel, name)) }))
  }, [channel, range])

  // Best / worst by cost per conversion (only campaigns with conversions).
  const withConv = rows.filter((r) => r.totals.conversions > 0)
  const best = withConv.reduce<typeof withConv[number] | null>((b, r) => (!b || r.totals.costPerConversion < b.totals.costPerConversion ? r : b), null)
  const worst = withConv.reduce<typeof withConv[number] | null>((w, r) => (!w || r.totals.costPerConversion > w.totals.costPerConversion ? r : w), null)

  const sorted = [...rows].sort((a, b) => {
    let av: number | string
    let bv: number | string
    if (sort.key === 'campaign') {
      av = a.name
      bv = b.name
    } else {
      av = a.totals[sort.key]
      bv = b.totals[sort.key]
    }
    const cmp = typeof av === 'string' ? (av as string).localeCompare(bv as string) : (av as number) - (bv as number)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const cols: { key: SortKey; label: string; render: (t: AdTotals) => string; align: string }[] = [
    { key: 'spend', label: 'Spend', render: (t) => fmtEur(t.spend), align: 'text-right' },
    { key: 'impressions', label: 'Impr.', render: (t) => fmtInt(t.impressions), align: 'text-right' },
    { key: 'clicks', label: 'Clicks', render: (t) => fmtInt(t.clicks), align: 'text-right' },
    { key: 'conversions', label: 'Conv.', render: (t) => fmtInt(t.conversions), align: 'text-right' },
    { key: 'costPerConversion', label: 'Cost/conv', render: (t) => fmtEur(t.costPerConversion, 2), align: 'text-right' },
    { key: 'convRate', label: 'CVR', render: (t) => fmtPct(t.convRate), align: 'text-right' },
    { key: 'ctr', label: 'CTR', render: (t) => fmtPct(t.ctr, 2), align: 'text-right' },
  ]

  function toggle(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }

  if (!rows.length) return <ChartCard title="Campaigns"><EmptyState /></ChartCard>

  return (
    <ChartCard title="Campaign performance" subtitle="Sortable · best & worst cost per conversion highlighted">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline text-[11px] uppercase tracking-wider text-muted">
              <SortHead label="Campaign" active={sort.key === 'campaign'} dir={sort.dir} onClick={() => toggle('campaign')} align="text-left" />
              {cols.map((c) => (
                <SortHead key={c.key} label={c.label} active={sort.key === c.key} dir={sort.dir} onClick={() => toggle(c.key)} align="text-right" />
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isBest = best?.name === r.name
              const isWorst = worst?.name === r.name
              return (
                <tr key={r.name} className="border-b border-hairline/60 last:border-0">
                  <td className="py-2.5 pr-4">
                    <span className="font-medium text-navy">{r.name}</span>
                    {isBest && <span className="ml-2 rounded-full bg-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-green">Best</span>}
                    {isWorst && <span className="ml-2 rounded-full bg-coral/10 px-1.5 py-0.5 text-[10px] font-semibold text-coral">Worst</span>}
                  </td>
                  {cols.map((c) => (
                    <td
                      key={c.key}
                      className={[
                        'px-2 py-2.5 tabular-nums',
                        c.align,
                        c.key === 'costPerConversion' && isBest ? 'font-semibold text-green' : '',
                        c.key === 'costPerConversion' && isWorst ? 'font-semibold text-coral' : 'text-ink',
                      ].join(' ')}
                    >
                      {c.render(r.totals)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  )
}

function SortHead({ label, active, dir, onClick, align }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; align: string }) {
  return (
    <th className={`py-2 ${align === 'text-left' ? 'pr-4' : 'px-2'} font-semibold`}>
      <button onClick={onClick} className={`inline-flex items-center gap-1 ${align === 'text-right' ? 'justify-end w-full' : ''} ${active ? 'text-navy' : 'hover:text-navy'}`}>
        {label}
        {active ? dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : <ChevronsUpDown size={11} className="opacity-40" />}
      </button>
    </th>
  )
}

// ---- Trend charts -----------------------------------------------------------
function TrendCharts({ channel, campaign }: { channel: Channel; campaign: string }) {
  const series = useMemo(
    () => weeklyAdSeries(getAdMetrics(FULL_RANGE, channel, campaign)).map((w) => ({ ...w, label: fmtDay(w.week) })),
    [channel, campaign],
  )
  if (!series.length) return null
  const tip = { contentStyle: { borderRadius: 12, border: '1px solid #ECEEF2', fontSize: 12 } }
  const axisX = { dataKey: 'label', tick: { fontSize: 11, fill: '#6B7280' }, tickLine: false, axisLine: false }
  const axisY = { tick: { fontSize: 11, fill: '#6B7280' }, tickLine: false, axisLine: false, width: 48 }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <ChartCard title="Spend over time" subtitle="Weekly">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#14365C" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#14365C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#ECEEF2" />
            <XAxis {...axisX} />
            <YAxis {...axisY} tickFormatter={(v: number) => `€${Math.round(v)}`} />
            <Tooltip {...tip} formatter={(v: number) => [fmtEur(v), 'Spend']} />
            <Area type="monotone" dataKey="spend" stroke="#14365C" strokeWidth={2} fill="url(#spendFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Conversions over time" subtitle="Weekly">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#ECEEF2" />
            <XAxis {...axisX} />
            <YAxis {...axisY} />
            <Tooltip {...tip} formatter={(v: number) => [fmtInt(v), 'Conversions']} />
            <Line type="monotone" dataKey="conversions" stroke="#3BB54A" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Cost per conversion" subtitle="Weekly · lower is better">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#ECEEF2" />
            <XAxis {...axisX} />
            <YAxis {...axisY} tickFormatter={(v: number) => `€${Math.round(v)}`} />
            <Tooltip {...tip} formatter={(v: number) => [fmtEur(v, 2), 'Cost/conv']} />
            <Line type="monotone" dataKey="costPerConversion" stroke="#F5A623" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

// ---- AI overview panel (rule based) ----------------------------------------
function AiPanel({ channel }: { channel: Channel }) {
  const { range } = useApp()
  const summary = useMemo(() => {
    const cur = sumAdRows(getAdMetrics(range, channel))
    const prev = sumAdRows(getAdMetrics(priorPeriod(range), channel))
    const campaigns = getCampaigns(channel).map((name) => ({
      name,
      current: sumAdRows(getAdMetrics(range, channel, name)),
      prior: sumAdRows(getAdMetrics(priorPeriod(range), channel, name)),
    }))
    return generateChannelSummary({ channelLabel: CHANNEL_LABEL[channel] + ' Ads', current: cur, prior: prev, campaigns })
  }, [channel, range])

  return (
    <Card className="border-navy/15 bg-navy/[0.03]">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-navy text-gold">
          <Sparkles size={15} />
        </span>
        <h3 className="text-sm font-semibold text-navy">AI overview</h3>
        <span className="rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
          {summary.source === 'rules' ? 'Rule-based v1' : 'Claude'}
        </span>
      </div>
      <ul className="space-y-1.5">
        {summary.sentences.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
            {s}
          </li>
        ))}
      </ul>
    </Card>
  )
}
