import { useEffect, useState } from 'react'

// Brand wordmark: SPORTS (navy) PHYSIO (gold) IRELAND (navy), uppercase sans.
// If /public/logo.svg exists it is used instead (per brief).
export function Wordmark() {
  const [hasLogo, setHasLogo] = useState(false)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setHasLogo(true)
    img.onerror = () => setHasLogo(false)
    img.src = '/logo.svg'
  }, [])

  if (hasLogo) return <img src="/logo.svg" alt="Sports Physio Ireland" className="h-8 w-auto" />

  return (
    <div className="flex items-center gap-2 select-none">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-navy text-base font-extrabold text-gold">
        S
      </span>
      <span className="text-[15px] font-extrabold uppercase tracking-wide">
        <span className="text-navy">Sports </span>
        <span className="text-gold">Physio </span>
        <span className="text-navy">Ireland</span>
      </span>
    </div>
  )
}
