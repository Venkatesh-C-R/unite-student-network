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

// One banner-red bar: logo, section links, then theme and sign-in on the right.
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

  const pill = 'rounded px-3 py-1.5 text-sm font-semibold'

  return (
    <header className="nav-red sticky top-0 z-50 bg-[var(--brand)] text-[#fffaf0] shadow-md shadow-black/20">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5" aria-label="Main">
        <button onClick={() => go('top')} className="flex items-center gap-2" aria-label="UNITE home">
          <Logo size={34} />
          <span className="wordmark text-xl font-bold">UNITE</span>
        </button>

        <div className="flex h-full items-stretch gap-1">
          <ul className="hidden h-full items-stretch lg:flex">
            {LINKS.map(([id, label]) => (
              <li key={id}>
                <button
                  onClick={() => go(id)}
                  aria-current={active === id ? 'true' : undefined}
                  className={`h-full border-b-2 px-3 text-sm font-semibold transition-colors ${
                    active === id ? 'border-[#fffaf0] text-[#fffaf0]' : 'border-transparent text-[#fffaf0]/75 hover:text-[#fffaf0]'
                  }`}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 lg:ml-3">
            <button onClick={onToggleTheme} className={`${pill} hover:bg-white/15`} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {user ? (
              <>
                <button onClick={onSignOut} className={`${pill} hidden hover:bg-white/15 sm:block`}>
                  Sign out
                </button>
                <Link to="/groups" className={`${pill} bg-[#fffaf0] text-[#9a1916] hover:bg-white`}>
                  My union
                </Link>
              </>
            ) : (
              <button onClick={onSignIn} className={`${pill} bg-[#fffaf0] text-[#9a1916] hover:bg-white`}>
                Sign in
              </button>
            )}
            <button
              className="grid h-10 w-10 place-items-center rounded-md border border-white/30 lg:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Open menu"
              aria-expanded={open}
            >
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </nav>

      {open && (
        <ul className="border-t border-white/20 px-5 py-2 lg:hidden">
          {LINKS.map(([id, label]) => (
            <li key={id}>
              <button onClick={() => go(id)} className="block w-full py-3 text-left font-semibold text-[#fffaf0]/80 hover:text-[#fffaf0]">
                {label}
              </button>
            </li>
          ))}
          {user && (
            <li className="sm:hidden">
              <button onClick={onSignOut} className="block w-full py-3 text-left font-semibold text-[#fffaf0]/80 hover:text-[#fffaf0]">
                Sign out
              </button>
            </li>
          )}
        </ul>
      )}
    </header>
  )
}
