import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)
export const ToastContext = createContext(() => {})

export const useAuth = () => useContext(AuthContext)
export const useToast = () => useContext(ToastContext)
