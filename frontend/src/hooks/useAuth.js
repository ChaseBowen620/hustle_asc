import { create } from 'zustand'
import axios from 'axios'
import { API_URL } from '@/config/api'

const useAuth = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')),
  
  isAdmin: (user) => {
    // Check if user is in Admin group OR if their student profile has is_admin=True
    return user?.groups?.includes('Admin') || user?.student_profile?.is_admin === true
  },
  
  login: async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/api/token/`, {
        username,
        password,
      })

      const { access, refresh } = response.data

      // Get user details
      const userResponse = await axios.get(`${API_URL}/api/user/me/`, {
        headers: { Authorization: `Bearer ${access}` }
      })

      const userData = {
        ...userResponse.data,
        token: access,
        refresh: refresh,
      }

      localStorage.setItem('user', JSON.stringify(userData))
      set({ user: userData })

      // Set default Authorization header for future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${access}`

      return userData
    } catch (error) {
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('user')
    delete axios.defaults.headers.common['Authorization']
    set({ user: null })
  },

  updateUser: (userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    set({ user: userData })
  }
}))

export { useAuth } 