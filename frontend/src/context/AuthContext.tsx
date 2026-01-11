import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '../lib/api/services/authService'
import { authService } from '../lib/api/services/authService'

interface AuthContextValue {
  user: User | null
  token: string | null
  initialized: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')
    if (storedToken && storedUser) {
      setToken(storedToken)
      setUser(JSON.parse(storedUser))
    }
    setInitialized(true)

    // Listen for logout events from httpClient (e.g., on 401 errors)
    const handleLogout = () => {
      logout()
    }

    window.addEventListener('auth:logout', handleLogout)

    return () => {
      window.removeEventListener('auth:logout', handleLogout)
    }
  }, [])

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setToken(null)
    setUser(null)
  }

  const refreshUser = async () => {
    try {
      const updatedUser = await authService.me()
      console.log('🔄 Refreshed user from API:', updatedUser)
      console.log('🔄 User organization_id:', updatedUser.organization_id)
      const currentToken = localStorage.getItem('auth_token')
      if (currentToken) {
        localStorage.setItem('auth_user', JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
      // If refresh fails, don't logout - just log the error
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, initialized, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}