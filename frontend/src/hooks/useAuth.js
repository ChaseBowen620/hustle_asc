import { create } from 'zustand'

/**
 * Auth is no longer used: no individual logins or tokens.
 * Kept so components that read user?.token can stay unchanged (no header sent).
 */
const useAuth = create(() => ({
  user: null,
  login: async () => {},
  logout: () => {},
  isAdmin: () => false,
}))

export { useAuth }
