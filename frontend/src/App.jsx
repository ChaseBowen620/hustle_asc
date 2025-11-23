import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "./components/Layout"
import Navbar from "./components/Navbar"
import EventsListPage from "@/pages/EventsListPage"
import LoginPage from "./pages/LoginPage"
import { Toaster } from "./components/ui/toaster"
import { useAuth } from "@/hooks/useAuth"
import AdminDashboardPage from "./pages/AdminDashboardPage"

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/login" />
}

function App() {
  const { user } = useAuth()

  return (
    <Router>
      <div>
        {user ? <Navbar /> : null}
        <Routes>
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Protected routes */}
            <Route 
              path="/" 
              element={
                user ? (
                  <Navigate to="/admin/dashboard" replace />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <PrivateRoute>
                  <AdminDashboardPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/events"
              element={
                <PrivateRoute>
                  <EventsListPage />
                </PrivateRoute>
              }
            />
          </Route>

          {/* Catch all redirect */}
          <Route path="*" element={<Navigate to={user ? "/admin/dashboard" : "/login"} replace />} />
        </Routes>
        <Toaster />
      </div>
    </Router>
  )
}

export default App
