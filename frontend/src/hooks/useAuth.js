import { create } from 'zustand'
import { API_URL } from '@/config/api'

const useAuth = create((set) => {
  const storedUser = localStorage.getItem('user')
  let user = null
  try {
    user = storedUser ? JSON.parse(storedUser) : null
  } catch {
    user = null
  }

  return {
    user,

    login: async (username, password) => {
      const res = await fetch(`${API_URL}/api/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || err.message || 'Invalid credentials')
      }
      const data = await res.json()
      const userData = {
        username: data.username ?? username,
        token: data.access,
        refresh: data.refresh,
        isAuthenticated: true,
        is_admin: data.is_admin ?? false,
        first_name: data.first_name,
        last_name: data.last_name,
        student_id: data.student_id,
        student_profile: data.student_profile,
        admin_profile: data.admin_profile,
      }
      localStorage.setItem('user', JSON.stringify(userData))
      set({ user: userData })
      return userData
    },

    logout: () => {
      localStorage.removeItem('user')
      set({ user: null })
    },

    isAdmin: (user) => {
      return user && (user.is_admin === true || user.isAuthenticated === true)
    },
  }
})

export { useAuth }
