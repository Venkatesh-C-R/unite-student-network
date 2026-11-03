import { useCallback, useEffect, useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { AuthProvider } from './auth'
import { useAuth } from './context'
import AppShell from './components/app/AppShell'
import BusyStar from './components/BusyStar'
import SignInModal from './components/SignInModal'
import AdminPage from './pages/AdminPage'
import ClaimsPage from './pages/ClaimsPage'
import DiscoverPage from './pages/DiscoverPage'
import GroupDetail from './pages/GroupDetail'
import GroupsPage from './pages/GroupsPage'
import Landing from './pages/Landing'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import ReviewPage from './pages/ReviewPage'
import StudentPage from './pages/StudentPage'
import { ToastProvider } from './toast'

function initialTheme() {
  try {
    return localStorage.getItem('unite-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  } catch {
    return 'light'
  }
}

function SignIn({ open, onClose }) {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <SignInModal
      open={open}
      onClose={onClose}
      onSignedIn={(u) => {
        setUser(u)
        onClose()
        // Groups is the home page after signing in; faculty and admins start on Review
        if (location.pathname === '/') navigate(u.role === 'student' ? '/groups' : '/review')
      }}
    />
  )
}

export default function App() {
  const [theme, setTheme] = useState(initialTheme)
  const [signIn, setSignIn] = useState(false)
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  const openSignIn = useCallback(() => setSignIn(true), [])
  const closeSignIn = useCallback(() => setSignIn(false), [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('unite-theme', theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  return (
    <AuthProvider onOpenSignIn={openSignIn}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing theme={theme} onToggleTheme={toggleTheme} />} />
          <Route element={<AppShell theme={theme} onToggleTheme={toggleTheme} />}>
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetail />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/students/:id" element={<StudentPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/claims" element={<ClaimsPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/review/:id" element={<ReviewPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SignIn open={signIn} onClose={closeSignIn} />
        <BusyStar />
      </ToastProvider>
    </AuthProvider>
  )
}
