import { Award, ClipboardCheck, LogOut, Moon, Search, ShieldCheck, Sun, Trophy, User, Users } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../../context'
import { Logo } from '../ui'
import { Avatar, Skeleton } from './kit'
import { btn } from '../../lib/styles'
import NotificationsBell from './NotificationsBell'

const STUDENT_NAV = [
  ['/groups', 'Unions', Users],
  ['/discover', 'Discover', Search],
  ['/claims', 'Claims', Award],
  ['/leaderboard', 'Leaderboard', Trophy],
  ['/profile', 'Profile', User],
]
// Faculty and admins review claims instead of submitting them
const STAFF_NAV = [
  ['/review', 'Review', ClipboardCheck],
  ['/groups', 'Unions', Users],
  ['/discover', 'Discover', Search],
  ['/leaderboard', 'Leaderboard', Trophy],
  ['/profile', 'Profile', User],
]
const ADMIN_NAV = [
  ['/review', 'Review', ClipboardCheck],
  ['/admin', 'Admin', ShieldCheck],
  ['/groups', 'Unions', Users],
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

      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="h-1 bg-violet-500" />
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2" aria-label="UNITE home">
            <Logo size={30} />
            <span className="text-lg font-bold text-violet-500">UNITE</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.map(([to, label, Icon]) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                className={({ isActive }) =>
                  `inline-flex h-16 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition lg:px-4 ${
                    isActive ? 'border-violet-500 text-violet-500' : 'border-transparent text-muted hover:text-violet-500'
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
            <button onClick={openSignIn} className={`${btn.primary} mt-6`}>
              Sign in
            </button>
          </div>
        )}
      </main>

      {user && (
        <nav className="fixed inset-x-0 bottom-0 border-t border-line bg-surface z-40 grid grid-cols-5 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
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
