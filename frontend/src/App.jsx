import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom"
import Layout from "./components/Layout"
import Navbar from "./components/Navbar"
import EventsListPage from "@/pages/EventsListPage"
import EventEditPage from "@/pages/EventEditPage"
import CheckInPage from "@/pages/CheckInPage"
import AboutPage from "./pages/AboutPage"
import { Toaster } from "./components/ui/toaster"
import AdminDashboardPage from "./pages/AdminDashboardPage"
import AuditPage from "./pages/AuditPage"
import PublicCheckInPage from "./pages/PublicCheckInPage"
import GeneralCheckInPage from "./pages/GeneralCheckInPage"
import ScanCheckInPage from "./pages/ScanCheckInPage"
import { useLocation } from "react-router-dom"

function AppContent() {
  const location = useLocation()
  const isScanPage = location.pathname === "/scan" || location.pathname.startsWith("/scan/")

  return (
    <div>
      {!isScanPage && <Navbar />}
      <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/scan" element={<ScanCheckInPage />} />
            <Route path="/scan/:organization" element={<ScanCheckInPage />} />
            <Route path="/check-in/public/:eventId" element={<PublicCheckInPage />} />

            <Route path="/check-in" element={<CheckInPage />} />
            <Route path="/check-in/:eventId" element={<CheckInPage />} />

            <Route path="/dashboard" element={<AdminDashboardPage />} />
            <Route path="/audit" element={<AuditPage />} />
            <Route path="/events" element={<EventsListPage />} />
            <Route path="/events/:eventId/edit" element={<EventEditPage />} />

            <Route path="/check-in-guest" element={<GeneralCheckInPage />} />
          </Route>

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
