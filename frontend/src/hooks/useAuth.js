import { create } from 'zustand'

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
      // Hardcoded credentials
      const HARDCODED_USERNAME = 'ascslb@usu.edu'
      const HARDCODED_PASSWORD = 'HelpUniteShareTeachLeadEngage'
      
      if (username !== HARDCODED_USERNAME || password !== HARDCODED_PASSWORD) {
        throw new Error('Invalid credentials')
      }
      
      // Create user data object for authenticated user
      const userData = {
        username: HARDCODED_USERNAME,
        token: 'hardcoded-auth-token',
        refresh: 'hardcoded-refresh-token',
        isAuthenticated: true,
        is_admin: true,
        first_name: 'Admin',
        last_name: 'User',
        student_id: null,
        student_profile: null,
        admin_profile: null,
      }
      localStorage.setItem('user', JSON.stringify(userData))
      set({ user: userData })
      return userData
    },

    logout: () => {
      localStorage.removeItem('user')
      set({ user: null })
    },

    // Any logged-in user has full access; the only gate is /login
    isAdmin: (user) => !!user,
  }
})

export { useAuth }
