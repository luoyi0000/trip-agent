import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

const TOKEN_KEY = 'travel_auth_token'
const USER_KEY = 'travel_auth_user'
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export interface AuthUser {
  id: string
  email: string
  username: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>
  register: (email: string, password: string, username: string) => Promise<{ success: boolean; message: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [isLoading, setIsLoading] = useState(true)

  // 初始化时验证已有 token 是否有效
  useEffect(() => {
    if (!token) {
      setIsLoading(false)
      return
    }
    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          const u: AuthUser = { id: data.data.id, email: data.data.email, username: data.data.username }
          setUser(u)
          localStorage.setItem(USER_KEY, JSON.stringify(u))
        } else {
          // token 无效，清除
          setToken(null)
          localStorage.removeItem(TOKEN_KEY)
          localStorage.removeItem(USER_KEY)
        }
      })
      .catch(() => {
        // 网络错误，尝试从缓存恢复
        const cached = localStorage.getItem(USER_KEY)
        if (cached) {
          try { setUser(JSON.parse(cached)) } catch { /* ignore */ }
        }
      })
      .finally(() => setIsLoading(false))
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (data.success && data.data) {
      setToken(data.data.token)
      setUser(data.data.user)
      localStorage.setItem(TOKEN_KEY, data.data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.data.user))
    }
    return { success: data.success, message: data.message }
  }, [])

  const register = useCallback(async (email: string, password: string, username: string) => {
    const anonymousId = localStorage.getItem('travel_user_id') || ''

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (anonymousId) {
      headers['x-anonymous-id'] = anonymousId
    }

    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, username }),
    })
    const data = await res.json()
    if (data.success && data.data) {
      setToken(data.data.token)
      setUser(data.data.user)
      localStorage.setItem(TOKEN_KEY, data.data.token)
      localStorage.setItem(USER_KEY, JSON.stringify(data.data.user))
    }
    return { success: data.success, message: data.message }
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
