import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import Layout from "./components/Layout"
import Navbar from "./components/Navbar"
import PublicNavbar from "./components/PublicNavbar"
import EventsListPage from "@/pages/EventsListPage"
import CheckInPage from "@/pages/CheckInPage"
import AdminPage from "@/pages/AdminPage"
import LoginPage from "./pages/LoginPage"
import LandingPage from "./pages/LandingPage"
import AboutPage from "./pages/AboutPage"
import RegisterPage from "./pages/RegisterPage"
import { Toaster } from "./components/ui/toaster"
import { useAuth } from "@/hooks/useAuth"
import StudentDashboard from "./pages/StudentDashboard"

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function App() {
  const { user, isAdmin } = useAuth()
  const userIsAdmin = isAdmin(user)

  // Redirect if logged in
  if (user && window.location.pathname === '/') {
    return <Navigate to={userIsAdmin ? "/events" : "/dashboard"} replace />
  }

  return (
    <Router>
      <div>
        {user ? <Navbar /> : <PublicNavbar />}
        <Routes>
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Student route */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <StudentDashboard />
                </PrivateRoute>
              }
            />

            {/* Admin routes */}
            {userIsAdmin && (
              <>
                <Route path="/events" element={<EventsListPage />} />
                <Route path="/check-in" element={<CheckInPage />} />
                <Route path="/check-in/:eventId" element={<CheckInPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </>
            )}
          </Route>

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  )
}

export default App
