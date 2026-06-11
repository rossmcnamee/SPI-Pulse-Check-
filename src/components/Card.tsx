import type { ReactNode } from 'react'

// Calm card surface: white, rounded-2xl, thin hairline border, soft shadow.
export function Card({
  children,
  className = '',
  accent = false,
}: {
  children: ReactNode
  className?: string
  // accent => gold-edged North Star treatment. Use sparingly (gold is precious).
  accent?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl bg-card p-5 shadow-card',
        accent ? 'border border-gold/40 ring-1 ring-gold/20' : 'border border-hairline',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  )
}

export function CardLabel({ children }: { children: ReactNode }) {
  return <div className="kpi-label">{children}</div>
}
