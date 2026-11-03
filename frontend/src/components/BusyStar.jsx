import { useEffect, useState } from 'react'
import { onBusyChange } from '../api'
import { Star } from './ui'

// When an action (any non-GET request) takes longer than a moment, spin the union star mid-screen.
export default function BusyStar() {
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => onBusyChange(setBusy), [])

  useEffect(() => {
    if (!busy) {
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), 400)
    return () => clearTimeout(t)
  }, [busy])

  if (!show) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[90] grid place-items-center" role="status" aria-label="Working…">
      <div className="rounded-3xl bg-[#1E1B16]/80 p-4 shadow-2xl backdrop-blur-sm">
        <Star size={64} tile={false} className="animate-[spin_1.2s_linear_infinite] motion-reduce:animate-[pulse_1.5s_ease-in-out_infinite]" />
      </div>
    </div>
  )
}
