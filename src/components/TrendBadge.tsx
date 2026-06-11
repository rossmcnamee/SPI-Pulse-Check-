import { ArrowDown, ArrowRight, ArrowUp } from 'lucide-react'
import type { Trend, TrendSense } from '../types'
import { arrowDir, trendColor } from '../lib/metrics'
import { fmtDeltaPct } from '../lib/format'

const TEXT: Record<string, string> = {
  green: 'text-green',
  coral: 'text-coral',
  navy: 'text-navy',
}

// Small arrow + signed % whose colour follows the metric's trend sense
// (Section 7: up isn't always good; spend is neutral navy).
export function TrendBadge({
  trend,
  sense,
  suffix = 'WoW',
  className = '',
}: {
  trend: Trend
  sense: TrendSense
  suffix?: string
  className?: string
}) {
  const color = trendColor(trend, sense)
  const dir = arrowDir(trend)
  const Icon = dir === 'up' ? ArrowUp : dir === 'down' ? ArrowDown : ArrowRight
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${TEXT[color]} ${className}`}>
      <Icon size={14} strokeWidth={2.5} />
      {fmtDeltaPct(trend.deltaPct)}
      {suffix && <span className="font-medium text-muted">{suffix}</span>}
    </span>
  )
}
