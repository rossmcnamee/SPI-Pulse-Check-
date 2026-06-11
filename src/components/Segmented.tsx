// Reusable segmented control (location toggle, channel selector, presets).
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'
  return (
    <div className="inline-flex rounded-xl border border-hairline bg-bg p-0.5">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              pad,
              'rounded-lg font-medium transition-colors',
              active ? 'bg-card text-navy shadow-sm' : 'text-muted hover:text-navy',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
