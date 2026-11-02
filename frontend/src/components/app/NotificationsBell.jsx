import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../../api'
import { timeAgo } from '../../lib/format'
import { btn } from '../../lib/styles'

export default function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const ref = useRef(null)
  const navigate = useNavigate()

  const load = useCallback(() => {
    api('/notifications')
      .then((d) => {
        setItems(d.notifications)
        setUnread(d.unread)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  async function markAll() {
    await api('/notifications/read', { method: 'POST', body: {} }).catch(() => {})
    load()
  }

  // Only in-app links we know how to open
  function openItem(n) {
    setOpen(false)
    const link = n.link || ''
    if (/^\/(groups|students)\/\d+$/.test(link)) navigate(link)
    else if (link.startsWith('/review')) navigate('/review')
    else if (link.startsWith('/achievements')) navigate('/claims')
    else if (link.startsWith('/admin')) navigate('/admin')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o)
          if (!open) load()
        }}
        className={`${btn.icon} relative`}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="bg-gradient-brand absolute -top-0.5 -right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            className="fixed top-16 right-3 left-3 z-50 overflow-hidden rounded-3xl border border-line bg-surface-strong shadow-2xl sm:absolute sm:top-12 sm:right-0 sm:left-auto sm:w-96"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <p className="font-display font-semibold">Notifications</p>
              {unread > 0 && (
                <button onClick={markAll} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 dark:text-violet-400">
                  <CheckCheck size={14} /> Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {items.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted">You’re all caught up.</li>}
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openItem(n)}
                    className={`flex w-full gap-3 px-5 py-3 text-left text-sm transition hover:bg-violet-500/10 ${n.isRead ? 'text-muted' : ''}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isRead ? 'bg-transparent' : 'bg-gradient-brand'}`} />
                    <span className="flex-1">
                      {n.message}
                      <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
