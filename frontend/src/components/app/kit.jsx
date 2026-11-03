import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { programmeColor, shortProgramme } from '../../lib/programme'
import { btn } from '../../lib/styles'


export function Avatar({ name, size = 40, color }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36, background: color || 'linear-gradient(120deg,#9a1916,#c8231f,#d8a227)' }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}

export function ProgrammeChip({ id, level, name, className = '' }) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-line px-2.5 py-0.5 text-xs font-medium ${className}`}
      title={`${level} · ${name}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: programmeColor(id) }} />
      <span className="truncate">{shortProgramme(level, name)}</span>
    </span>
  )
}

// Six slots: filled ones show who holds them, empty ones show room left
export function SlotDots({ count, max = 6, size = 10 }) {
  return (
    <span className="inline-flex gap-1" aria-label={`${count} of ${max} members`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${i < count ? 'bg-gradient-brand' : 'border border-line'}`}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  )
}

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-2xl bg-violet-500/10 ${className}`} />
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="glass flex flex-col items-center rounded-3xl px-6 py-12 text-center">
      {Icon && (
        <span className="bg-gradient-brand mb-4 grid h-14 w-14 place-items-center rounded-2xl text-white">
          <Icon size={24} />
        </span>
      )}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Dialog({ open, onClose, title, children, wide = false }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[85] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={`gradient-border relative my-8 w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-3xl bg-surface-strong p-6 shadow-2xl sm:p-7`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="font-display text-xl font-bold">{title}</h2>
              <button onClick={onClose} className={btn.icon} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
