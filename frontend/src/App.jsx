import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import { useState, useEffect } from "react"
import Navbar from "./components/Navbar"
import PublicNavbar from "./components/PublicNavbar"
import EventsPage from "./pages/EventsPage"
import AttendancePage from "./pages/AttendancePage"
import PositionsPage from "./pages/PositionsPage"
import LoginPage from "./pages/LoginPage"
import LandingPage from "./pages/LandingPage"
import AboutPage from "./pages/AboutPage"

function PrivateRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  return user ? children : <Navigate to="/login" />
}

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'))

  useEffect(() => {
    const handleStorageChange = () => {
      setUser(JSON.parse(localStorage.getItem('user') || 'null'))
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Function to update user state
  const updateUser = (userData) => {
    setUser(userData)
  }

  return (
    <Router>
      <div>
        {user ? <Navbar updateUser={updateUser} /> : <PublicNavbar />}
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage updateUser={updateUser} />} />
          <Route
            path="/events"
            element={
              <PrivateRoute>
                <EventsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <PrivateRoute>
                <AttendancePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/positions"
            element={
              <PrivateRoute>
                <PositionsPage />
              </PrivateRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  )
}

export default App
