import { useState } from 'react'
import { RefreshCw, X } from 'lucide-react'
import { CsvDropzone } from './CsvDropzone'
import { CONVERSION_DEFINITIONS, NEW_PATIENT_COUNT_POINT, NEW_PATIENT_DEFINITION } from '../config/metrics'
import { getMeta, refreshLiveAdRows, refreshLiveNewPatients, useStoreVersion } from '../data/store'

// Slide-over drawer for managing data sources. New patients is LIVE from Cliniko;
// ad performance is LIVE from Google Ads + Meta (CSV upload remains an override).
export function DataManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  useStoreVersion() // re-render when live data lands / refreshes
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingAds, setRefreshingAds] = useState(false)
  const np = getMeta('newPatients')
  const ads = getMeta('adRows')

  async function refresh() {
    setRefreshing(true)
    await refreshLiveNewPatients(true)
    setRefreshing(false)
  }

  async function refreshAds() {
    setRefreshingAds(true)
    await refreshLiveAdRows(true)
    setRefreshingAds(false)
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-navy/30 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-bg shadow-xl">
        <div className="flex items-center justify-between border-b border-hairline bg-card px-5 py-4">
          <h2 className="text-base font-bold text-navy">Data sources</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-navy">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-hairline bg-card p-4 text-xs leading-relaxed text-muted">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy">New patients · Live from Cliniko</h3>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-bg px-2.5 py-1 text-[11px] font-medium text-navy hover:bg-card disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? 'Refreshing…' : 'Refresh from Cliniko'}
              </button>
            </div>
            <p>
              {np.source === 'live'
                ? `Pulling real new-patient bookings (D2/D7) straight from Cliniko · ${np.rows} rows${np.updatedAt ? ' · updated ' + new Date(np.updatedAt).toLocaleString() : ''}.`
                : 'Live Cliniko data is loading… (showing sample meanwhile). If this persists, make sure the dev server is running.'}
            </p>
            <p className="mt-1.5">
              Ad performance (Google/Meta/YouTube) is still sample data via CSV below — those APIs come next.
            </p>
          </div>

          <div className="rounded-xl border border-hairline bg-card p-4 text-xs leading-relaxed text-muted">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-navy">Ad performance · Live from Google &amp; Meta</h3>
              <button
                onClick={refreshAds}
                disabled={refreshingAds}
                className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-bg px-2.5 py-1 text-[11px] font-medium text-navy hover:bg-card disabled:opacity-50"
              >
                <RefreshCw size={12} className={refreshingAds ? 'animate-spin' : ''} />
                {refreshingAds ? 'Refreshing…' : 'Refresh from ad platforms'}
              </button>
            </div>
            <p>
              {ads.source === 'live'
                ? `Pulling real campaign spend & conversions straight from Google Ads + Meta · ${ads.rows} rows${ads.updatedAt ? ' · updated ' + new Date(ads.updatedAt).toLocaleString() : ''}.`
                : ads.source === 'upload'
                  ? `Using your uploaded CSV (${ads.rows} rows). Refresh above to switch back to live data.`
                  : 'Live ad data is loading… (showing sample meanwhile). If this persists, make sure the dev server is running.'}
            </p>
            <p className="mt-1.5">
              YouTube (video) is wired too — it appears automatically when a video campaign has recent spend. Use a custom
              date range to see Meta history (last spend Feb 2026).
            </p>
          </div>

          <CsvDropzone
            id="adRows"
            title="Ad performance · CSV override"
            schemaHint="date, channel, campaign, spend, impressions, clicks, conversions · overrides live data until reset"
            template={{
              filename: 'ad_performance.csv',
              content:
                'date,channel,campaign,spend,impressions,clicks,conversions\n' +
                '2026-06-01,google,Plantar Fasciitis Search,42.50,1820,96,4\n' +
                '2026-06-01,meta,GrowForm Lead Campaign,30.00,5400,210,6\n' +
                '2026-06-01,youtube,Brand Awareness,18.00,9200,140,2\n',
            }}
          />

          <div className="rounded-xl border border-hairline bg-card p-4 text-xs leading-relaxed text-muted">
            <h3 className="mb-2 text-sm font-semibold text-navy">Definitions to confirm</h3>
            <p className="mb-2">
              <span className="font-semibold text-ink">New patient:</span> {NEW_PATIENT_DEFINITION} Counted at{' '}
              <span className="font-semibold text-ink">{NEW_PATIENT_COUNT_POINT}</span> (confirm).
            </p>
            <p className="mb-1 font-semibold text-ink">Conversion per channel:</p>
            <ul className="ml-4 list-disc space-y-0.5">
              {Object.entries(CONVERSION_DEFINITIONS).map(([ch, def]) => (
                <li key={ch}>
                  <span className="font-medium capitalize text-ink">{ch}:</span> {def}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  )
}
