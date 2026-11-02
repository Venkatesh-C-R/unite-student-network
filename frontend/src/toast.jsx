import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { ToastContext } from './context'

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t.slice(-2), { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500)
  }, [])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[95] flex flex-col items-center gap-2 px-4 sm:bottom-6" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border bg-surface-strong p-4 text-sm shadow-2xl ${
                t.type === 'error' ? 'border-rose-500/40' : 'border-emerald-500/40'
              }`}
              role={t.type === 'error' ? 'alert' : 'status'}
            >
              {t.type === 'error' ? (
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
              ) : (
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-500" />
              )}
              <span className="flex-1">{t.message}</span>
              <button onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="text-muted hover:text-ink">
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
