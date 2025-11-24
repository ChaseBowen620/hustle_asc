import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom"
import Layout from "./components/Layout"
import Navbar from "./components/Navbar"
import PublicNavbar from "./components/PublicNavbar"
import EventsListPage from "@/pages/EventsListPage"
import CheckInPage from "@/pages/CheckInPage"
import LoginPage from "./pages/LoginPage"
import LandingPage from "./pages/LandingPage"
import AboutPage from "./pages/AboutPage"
import RegisterPage from "./pages/RegisterPage"
import { Toaster } from "./components/ui/toaster"
import { useAuth } from "@/hooks/useAuth"
import StudentDashboard from "./pages/StudentDashboard"
import AdminDashboardPage from "./pages/AdminDashboardPage"
import SettingsPage from "./pages/SettingsPage"
import PublicCheckInPage from "./pages/PublicCheckInPage"
import GeneralCheckInPage from "./pages/GeneralCheckInPage"

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function AppContent() {
  const { user, isAdmin } = useAuth()
  const userIsAdmin = isAdmin(user)
  const location = useLocation()
  const isLoginPage = location.pathname === '/login'

  return (
    <div>
      {user ? <Navbar /> : (isLoginPage ? null : <PublicNavbar />)}
        <Routes>
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route 
              path="/" 
              element={
                user ? (
                  <Navigate to={userIsAdmin ? "/admin/dashboard" : "/dashboard"} replace />
                ) : (
                  <LandingPage />
                )
              } 
            />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/check-in" element={<GeneralCheckInPage />} />
            <Route path="/check-in/public/:eventId" element={<PublicCheckInPage />} />

            {/* Student route */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <StudentDashboard />
                </PrivateRoute>
              }
            />

            {/* Settings route - available to all authenticated users */}
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              }
            />

            {/* Admin routes */}
            {userIsAdmin && (
              <>
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/events" element={<EventsListPage />} />
                <Route path="/check-in" element={<CheckInPage />} />
                <Route path="/check-in/:eventId" element={<CheckInPage />} />
              </>
            )}
          </Route>

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </div>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
