import { create } from 'zustand'

const VALID_USERNAME = import.meta.env.VITE_LOGIN_USERNAME || 'ascslb@usu.edu'
const VALID_PASSWORD = import.meta.env.VITE_LOGIN_PASSWORD || 'HelpUniteShareTeachLeadEngage'

const useAuth = create((set) => {
  const storedUser = localStorage.getItem('user')
  const user = storedUser ? JSON.parse(storedUser) : null

  return {
    user,

    login: async (username, password) => {
      if (username === VALID_USERNAME && password === VALID_PASSWORD) {
        const userData = {
          username: VALID_USERNAME,
          isAuthenticated: true,
        }
        localStorage.setItem('user', JSON.stringify(userData))
        set({ user: userData })
        return userData
      }
      throw new Error('Invalid credentials')
    },

    logout: () => {
    localStorage.removeItem('user')
    set({ user: null })
  },

  isAdmin: (user) => {
    // For simplified auth, always return true if user is authenticated
    return user && user.isAuthenticated
  }
  }
})

export { useAuth } 