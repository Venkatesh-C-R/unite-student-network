import { AnimatePresence, motion, useScroll, useSpring } from 'framer-motion'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { scrollToId } from '../hooks/useLenis'
import { Logo, MagneticButton } from './ui'

const LINKS = [
  ['about', 'About'],
  ['features', 'Features'],
  ['playground', 'Playground'],
  ['scoring', 'Scoring'],
  ['downloads', 'Downloads'],
  ['team', 'Team'],
  ['faq', 'FAQ'],
]

export default function Navbar({ theme, onToggleTheme, onSignIn, user, onSignOut }) {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25 })

  useEffect(() => {
    const on = () => {
      setScrolled(window.scrollY > 24)
      // The current section is the last one whose top has passed 40% of the viewport
      let current = ''
      for (const [id] of LINKS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) current = id
      }
      setActive(current)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  function go(id) {
    setOpen(false)
    scrollToId(id)
  }

  return (
    <>
      <motion.div
        className="bg-gradient-brand fixed top-0 right-0 left-0 z-[60] h-[3px] origin-left"
        style={{ scaleX: progress }}
      />
      <header
        className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${
          scrolled ? 'py-3' : 'py-5'
        }`}
      >
        <nav
          className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2 transition-all duration-300 sm:px-6 ${
            scrolled ? 'glass mx-4 shadow-lg shadow-black/10 lg:mx-auto' : ''
          }`}
        >
          <button onClick={() => go('top')} className="flex items-center gap-2" aria-label="UNITE home">
            <Logo size={34} />
            <span className="font-display text-xl font-bold tracking-widest">UNITE</span>
          </button>

          <ul className="hidden items-center gap-1 lg:flex">
            {LINKS.map(([id, label]) => (
              <li key={id}>
                <button
                  onClick={() => go(id)}
                  aria-current={active === id ? 'true' : undefined}
                  className={`relative rounded-full px-3 py-2 text-sm font-medium transition-colors hover:text-ink ${
                    active === id ? 'text-ink' : 'text-muted'
                  }`}
                >
                  {active === id && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-full bg-violet-500/15"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative">{label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              className="glass grid h-10 w-10 place-items-center rounded-full"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>
            {user ? (
              <div className="glass hidden items-center gap-2 rounded-full py-1 pr-1 pl-1 sm:flex">
                <span className="bg-gradient-brand grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white">
                  {user.name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
                </span>
                <span className="max-w-32 truncate text-sm font-medium">{user.name}</span>
                <button onClick={onSignOut} className="rounded-full px-3 py-1.5 text-sm text-muted hover:bg-violet-500/10 hover:text-ink">
                  Sign out
                </button>
                <Link to="/groups" className="bg-gradient-brand rounded-full px-4 py-1.5 text-sm font-semibold text-white">
                  My groups
                </Link>
              </div>
            ) : (
              <MagneticButton
                onClick={onSignIn}
                className="bg-gradient-brand hidden rounded-full px-5 py-2.5 text-sm font-semibold text-white sm:inline-flex"
              >
                Sign in
              </MagneticButton>
            )}
            <button
              className="glass grid h-10 w-10 place-items-center rounded-full lg:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Open menu"
              aria-expanded={open}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              className="glass mx-4 mt-2 rounded-3xl p-4 lg:hidden"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {LINKS.map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => go(id)}
                  className="block w-full rounded-xl px-4 py-3 text-left font-medium hover:bg-violet-500/10"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => {
                  setOpen(false)
                  if (user) onSignOut()
                  else onSignIn()
                }}
                className="bg-gradient-brand mt-2 w-full rounded-xl px-4 py-3 font-semibold text-white"
              >
                {user ? `Sign out (${user.name})` : 'Sign in'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  )
}
