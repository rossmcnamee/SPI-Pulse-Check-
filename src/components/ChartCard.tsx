import type { ReactNode } from 'react'
import { Card } from './Card'

export function ChartCard({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  )
}
