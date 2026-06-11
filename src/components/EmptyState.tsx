import { Inbox } from 'lucide-react'

// Shown when the selected range/filter yields no rows.
export function EmptyState({ message = 'No data for this range.', hint }: { message?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-bg/50 px-6 py-10 text-center">
      <Inbox size={24} className="text-muted" />
      <p className="mt-2 text-sm font-medium text-navy">{message}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
