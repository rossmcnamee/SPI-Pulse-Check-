import { useState } from 'react'
import { AppProvider, useApp } from './state/AppContext'
import { useStoreVersion } from './data/store'
import { Header } from './components/Header'
import { DataManager } from './components/DataManager'
import { Overview } from './tabs/Overview'
import { NewPatients } from './tabs/NewPatients'
import { PaidAds } from './tabs/PaidAds'

function Shell() {
  const { tab } = useApp()
  const [dataOpen, setDataOpen] = useState(false)
  // Re-render the whole shell when the underlying datasets change (upload/reset).
  useStoreVersion()

  return (
    <div className="min-h-full bg-bg">
      <Header onOpenData={() => setDataOpen(true)} />
      <main className="mx-auto max-w-[1280px] px-6 py-6">
        {tab === 'overview' && <Overview />}
        {tab === 'newPatients' && <NewPatients />}
        {tab === 'paidAds' && <PaidAds />}
      </main>
      <footer className="mx-auto max-w-[1280px] px-6 py-6 text-center text-xs text-muted">
        Sports Physio Ireland · internal marketing dashboard · v1 · new patients live from Cliniko · ads live from Google &amp; Meta
      </footer>
      <DataManager open={dataOpen} onClose={() => setDataOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
