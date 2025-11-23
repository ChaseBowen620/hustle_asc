import { create } from 'zustand'

// Hardcoded credentials
const VALID_USERNAME = 'ascslb@usu.edu'
const VALID_PASSWORD = 'Landlady4-Overspend-Goldmine'

const useAuth = create((set) => {
  const storedUser = localStorage.getItem('user')
  const user = storedUser ? JSON.parse(storedUser) : null
  
  return {
    user,
  
  login: async (username, password) => {
      // Simple credential check
      if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      const userData = {
          username: VALID_USERNAME,
          isAuthenticated: true
      }
      localStorage.setItem('user', JSON.stringify(userData))
      set({ user: userData })
      return userData
      } else {
        throw new Error('Invalid credentials')
    }
  },

  logout: () => {
    localStorage.removeItem('user')
    set({ user: null })
  }
  }
})

export { useAuth } 