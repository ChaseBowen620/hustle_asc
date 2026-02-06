import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import Layout from "./components/Layout"
import Navbar from "./components/Navbar"
import PublicNavbar from "./components/PublicNavbar"
import EventsListPage from "@/pages/EventsListPage"
import EventEditPage from "@/pages/EventEditPage"
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
import ScanCheckInPage from "./pages/ScanCheckInPage"
import { useLocation } from "react-router-dom"

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function AppContent() {
  const { user, isAdmin } = useAuth()
  const userIsAdmin = isAdmin(user)
  const location = useLocation()
  const isScanPage = location.pathname === "/scan" || location.pathname.startsWith("/scan/")

  return (
    <div>
      {user && !isScanPage ? <Navbar /> : !isScanPage ? <PublicNavbar /> : null}
      <Routes>
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route 
              path="/" 
              element={
                user ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              } 
            />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* Public scan page (QR destination) - no navbar */}
            <Route path="/scan" element={<ScanCheckInPage />} />
            <Route path="/scan/:organization" element={<ScanCheckInPage />} />
            <Route path="/check-in/public/:eventId" element={<PublicCheckInPage />} />

            {/* Check-in: authenticated -> CheckInPage; unauthenticated -> GeneralCheckInPage */}
            <Route
              path="/check-in"
              element={user ? <CheckInPage /> : <GeneralCheckInPage />}
            />
            <Route
              path="/check-in/:eventId"
              element={user ? <CheckInPage /> : <PublicCheckInPage />}
            />

            {/* Dashboard - shows Admin or Student view based on role */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  {userIsAdmin ? <AdminDashboardPage /> : <StudentDashboard />}
                </PrivateRoute>
              }
            />

            {/* Settings - available to all authenticated users */}
            <Route
              path="/settings"
              element={
                <PrivateRoute>
                  <SettingsPage />
                </PrivateRoute>
              }
            />

            {/* Admin-only routes */}
            {userIsAdmin && (
              <>
                <Route path="/events" element={<EventsListPage />} />
                <Route path="/events/:eventId/edit" element={<EventEditPage />} />
              </>
            )}

            {/* Public check-in (unauthenticated users only) */}
            <Route path="/check-in-guest" element={<GeneralCheckInPage />} />
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
