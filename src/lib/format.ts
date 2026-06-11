// Display formatters. Pure, no side effects.

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-IE')
}

export function fmtEur(n: number, dp = 0): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n)
}

export function fmtPct(n: number, dp = 1): string {
  return `${n.toFixed(dp)}%`
}

// Signed percentage for deltas, e.g. "+18%" / "−4%". null -> "—".
export function fmtDeltaPct(deltaPct: number | null, dp = 0): string {
  if (deltaPct === null || !isFinite(deltaPct)) return '—'
  const sign = deltaPct > 0 ? '+' : deltaPct < 0 ? '−' : ''
  return `${sign}${Math.abs(deltaPct).toFixed(dp)}%`
}
