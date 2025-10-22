import { create } from 'zustand'
import axios from 'axios'
import { API_URL } from '@/config/api'

const useAuth = create((set) => {
  const user = JSON.parse(localStorage.getItem('user'))
  
  // Set axios default headers if user exists
  if (user?.token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${user.token}`
  }
  
  return {
    user,
    
    isAdmin: (user) => {
    // Check if user has an AdminUser profile (administrator account)
    return user?.admin_profile !== null && user?.admin_profile !== undefined
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
  }
})

export { useAuth } 