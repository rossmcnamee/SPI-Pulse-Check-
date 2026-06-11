import { Activity, BarChart3, Database, Users } from 'lucide-react'
import { useApp, type TabId } from '../state/AppContext'
import { Wordmark } from './Wordmark'
import { Segmented } from './Segmented'
import { DateFilter } from './DateFilter'
import type { LocationFilter } from '../types'

const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'newPatients', label: 'New Patients', icon: Users },
  { id: 'paidAds', label: 'Paid Ads', icon: BarChart3 },
]

const LOCATIONS: { value: LocationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'D2', label: 'Dublin 2' },
  { value: 'D7', label: 'Dublin 7' },
]

export function Header({ onOpenData }: { onOpenData: () => void }) {
  const { tab, setTab, location, setLocation } = useApp()

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-[1280px] px-6">
        {/* Row 1: wordmark · tabs · data manager */}
        <div className="flex h-16 items-center justify-between gap-6">
          <Wordmark />
          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={[
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
                    active ? 'bg-navy text-white' : 'text-muted hover:bg-bg hover:text-navy',
                  ].join(' ')}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              )
            })}
          </nav>
          <button
            onClick={onOpenData}
            className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-navy hover:bg-bg"
          >
            <Database size={16} />
            <span className="hidden sm:inline">Data</span>
          </button>
        </div>

        {/* Row 2: global controls — location toggle + date filter (apply everywhere) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex items-center gap-2">
            <span className="kpi-label hidden sm:inline">Location</span>
            <Segmented options={LOCATIONS} value={location} onChange={setLocation} size="sm" />
          </div>
          <DateFilter />
        </div>

        {/* Mobile tab nav */}
        <nav className="flex items-center gap-1 pb-2 md:hidden">
          {TABS.map((t) => {
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={[
                  'flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold',
                  active ? 'bg-navy text-white' : 'text-muted',
                ].join(' ')}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
