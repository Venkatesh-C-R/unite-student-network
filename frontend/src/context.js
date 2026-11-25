import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export const ToastContext = createContext(() => {})

export const useAuth = () => useContext(AuthContext)
export const useToast = () => useContext(ToastContext)

// Where a signed-in user starts: students on Unions, faculty and admins on Review
export const homeFor = (user) => (user.role === 'student' ? '/groups' : '/review')
