import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { AuthContext } from './context'

export function AuthProvider({ children, onOpenSignIn }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, setUser, ready, signOut, openSignIn: onOpenSignIn }), [user, ready, signOut, onOpenSignIn])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
