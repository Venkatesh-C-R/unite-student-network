import { Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { scrollToId } from '../hooks/useLenis'
import { Logo } from './ui'

const LINKS = [
  ['about', 'About'],
  ['features', 'Features'],
  ['playground', 'Playground'],
  ['scoring', 'Scoring'],
  ['downloads', 'Downloads'],
  ['team', 'Team'],
  ['faq', 'Rules & FAQ'],
]

// PSG Tech style: a slim blue utility bar above a plain header with text links.
export default function Navbar({ theme, onToggleTheme, onSignIn, user, onSignOut }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')

  useEffect(() => {
    const on = () => {
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

  const pill = 'rounded px-3 py-1 text-xs font-semibold'

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface">
      <div className="bg-violet-500 text-white">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-end gap-2 px-5">
          <button onClick={onToggleTheme} className={`${pill} hover:bg-white/15`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          {user ? (
            <>
              <button onClick={onSignOut} className={`${pill} hover:bg-white/15`}>
                Sign out
              </button>
              <Link to="/groups" className={`${pill} bg-white text-violet-600`}>
                My unions
              </Link>
            </>
          ) : (
            <button onClick={onSignIn} className={`${pill} bg-white text-violet-600`}>
              Sign in
            </button>
          )}
        </div>
      </div>

      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5" aria-label="Main">
        <button onClick={() => go('top')} className="flex items-center gap-2" aria-label="UNITE home">
          <Logo size={34} />
          <span className="wordmark text-xl font-bold">UNITE</span>
        </button>

        <ul className="hidden h-full items-stretch lg:flex">
          {LINKS.map(([id, label]) => (
            <li key={id}>
              <button
                onClick={() => go(id)}
                aria-current={active === id ? 'true' : undefined}
                className={`h-full border-b-2 px-3 text-sm font-semibold transition-colors ${
                  active === id ? 'border-violet-500 text-violet-500' : 'border-transparent text-muted hover:text-violet-500'
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>

        <button
          className="grid h-10 w-10 place-items-center rounded-md border border-line lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Open menu"
          aria-expanded={open}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </nav>

      {open && (
        <ul className="border-t border-line px-5 py-2 lg:hidden">
          {LINKS.map(([id, label]) => (
            <li key={id}>
              <button onClick={() => go(id)} className="block w-full py-3 text-left font-semibold text-muted hover:text-violet-500">
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </header>
  )
}
