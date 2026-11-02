import { Award, ClipboardCheck, LogOut, Moon, Search, ShieldCheck, Sun, Trophy, User, Users } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../context'
import { Logo } from '../ui'
import { Avatar, Skeleton } from './kit'
import { btn } from '../../lib/styles'
import NotificationsBell from './NotificationsBell'

const STUDENT_NAV = [
  ['/groups', 'Groups', Users],
  ['/discover', 'Discover', Search],
  ['/claims', 'Claims', Award],
  ['/leaderboard', 'Leaderboard', Trophy],
  ['/profile', 'Profile', User],
]
// Faculty and admins review claims instead of submitting them
const STAFF_NAV = [
  ['/review', 'Review', ClipboardCheck],
  ['/groups', 'Groups', Users],
  ['/discover', 'Discover', Search],
  ['/leaderboard', 'Leaderboard', Trophy],
  ['/profile', 'Profile', User],
]
const ADMIN_NAV = [
  ['/review', 'Review', ClipboardCheck],
  ['/admin', 'Admin', ShieldCheck],
  ['/groups', 'Groups', Users],
  ['/leaderboard', 'Leaderboard', Trophy],
  ['/profile', 'Profile', User],
]

// Layout for signed-in pages: top bar on desktop, bottom tabs on phones.
export default function AppShell({ theme, onToggleTheme }) {
  const { user, ready, signOut, openSignIn } = useAuth()
  const navigate = useNavigate()
  const NAV = user?.role === 'admin' ? ADMIN_NAV : user?.role === 'faculty' ? STAFF_NAV : STUDENT_NAV

  useEffect(() => {
    if (ready && !user) openSignIn()
  }, [ready, user, openSignIn])

  return (
    <div className="relative min-h-[100svh]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[30rem] w-[30rem] rounded-full bg-indigo-600 opacity-20 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 h-[26rem] w-[26rem] rounded-full bg-cyan-500 opacity-15 blur-[140px]" />
      </div>

      <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2" aria-label="UNITE home">
            <Logo size={30} />
            <span className="font-display text-lg font-bold tracking-widest">UNITE</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition lg:px-4 ${
                    isActive ? 'bg-violet-500/15 text-ink' : 'text-muted hover:text-ink'
                  }`
                }
              >
                <Icon size={16} aria-hidden="true" />
                {/* Icons only on tablets, labels from laptop width */}
                <span className="sr-only lg:not-sr-only">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <button onClick={onToggleTheme} className={btn.icon} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user && <NotificationsBell />}
            {user && (
              <div className="ml-1 flex items-center gap-2">
                <Avatar name={user.name} size={34} />
                <button
                  onClick={async () => {
                    await signOut()
                    navigate('/')
                  }}
                  className={btn.icon}
                  aria-label="Sign out"
                  title="Sign out"
                >
                  <LogOut size={17} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="relative mx-auto max-w-6xl px-4 pt-8 pb-28 md:pb-16">
        {!ready ? (
          <div className="space-y-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-48" />
          </div>
        ) : user ? (
          <Outlet />
        ) : (
          <div className="glass mx-auto mt-16 max-w-md rounded-3xl p-8 text-center">
            <h1 className="font-display text-2xl font-bold">Sign in to continue</h1>
            <p className="mt-2 text-muted">Groups, polls and the leaderboard are for PSG students with a UNITE account.</p>
            <button onClick={openSignIn} className={`${btn.primary} mt-6`}>
              Sign in
            </button>
          </div>
        )}
      </main>

      {user && (
        <nav className="glass fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
          {NAV.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${isActive ? 'text-violet-500' : 'text-muted'}`}
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}
