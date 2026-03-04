import { create } from 'zustand'
import { API_URL } from '@/config/api'

const AUTH_STORAGE_KEY = 'auth_user'

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const useAuth = create((set) => ({
  user: getStoredUser(),
  login: async (username, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { success: false, error: data.error || 'Invalid username or password.' }
      }
      const user = { token: data.access, refresh: data.refresh }
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
      set({ user })
      return { success: true }
    } catch (err) {
      return { success: false, error: 'Unable to reach the server. Please try again.' }
    }
  },
  logout: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    set({ user: null })
  },
  isAdmin: () => true,
}))

export { useAuth }
