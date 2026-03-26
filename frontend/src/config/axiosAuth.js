/**
 * Attach JWT to all axios requests to our API; attach CSRF token for POST/PUT/PATCH/DELETE
 * so public scan (register, check-in) can be protected without login.
 * Import this once from main.jsx so the interceptor is registered at app load.
 */
import axios from "axios"
import { API_URL } from "@/config/api"
import { useAuth } from "@/hooks/useAuth"

// Cross-origin (e.g. localhost → production API): cookies (csrftoken) only sent if credentials are on.
if (typeof window !== "undefined" && typeof API_URL === "string" && API_URL) {
  try {
    if (new URL(API_URL).origin !== window.location.origin) {
      axios.defaults.withCredentials = true
    }
  } catch {
    /* ignore invalid API_URL */
  }
}

function getCsrfCookie() {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(/\bcsrftoken=([^;]+)/)
  return match ? match[1] : null
}

axios.interceptors.request.use((config) => {
  const url = config.url ?? ""
  const base = typeof API_URL === "string" ? API_URL : ""
  if (base && url.startsWith(base)) {
    const token = useAuth.getState().user?.token
    if (token) {
      config.headers = { ...config.headers, Authorization: `Bearer ${token}` }
    }
    const method = (config.method ?? "get").toLowerCase()
    if (["post", "put", "patch", "delete"].includes(method)) {
      const csrf = getCsrfCookie()
      if (csrf) {
        config.headers = { ...config.headers, "X-CSRFToken": csrf }
      }
    }
  }
  return config
})
