import { create } from 'zustand'

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
    const envUser = import.meta.env.VITE_LOGIN_USERNAME ?? ''
    const envPass = import.meta.env.VITE_LOGIN_PASSWORD ?? ''
    const ok =
      String(username).trim() === String(envUser).trim() &&
      String(password) === String(envPass)
    if (!ok) {
      return { success: false, error: 'Invalid username or password.' }
    }
    const user = { token: 'authenticated' }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
    set({ user })
    return { success: true }
  },
  logout: () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    set({ user: null })
  },
  isAdmin: () => true,
}))

export { useAuth }
