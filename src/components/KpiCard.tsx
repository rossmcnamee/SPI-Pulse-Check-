import type { ReactNode } from 'react'
import type { Trend, TrendSense } from '../types'
import { Card } from './Card'
import { TrendBadge } from './TrendBadge'

// Standard KPI tile: small uppercase label, big confident value, optional trend.
export function KpiCard({
  label,
  value,
  sub,
  trend,
  sense,
  emphasis = false,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  trend?: Trend
  sense?: TrendSense
  emphasis?: boolean // give a metric extra weight (e.g. Spend on Paid Ads)
}) {
  return (
    <Card className={emphasis ? 'bg-navy/[0.02]' : ''}>
      <div className="kpi-label">{label}</div>
      <div className={`mt-2 font-bold tabular-nums text-navy ${emphasis ? 'text-4xl' : 'text-3xl'}`}>{value}</div>
      <div className="mt-2 flex items-center gap-2">
        {trend && sense && <TrendBadge trend={trend} sense={sense} />}
        {sub && <span className="text-xs text-muted">{sub}</span>}
      </div>
    </Card>
  )
}
