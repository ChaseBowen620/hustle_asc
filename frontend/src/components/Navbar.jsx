import { Link, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const linkClass = (path) =>
    `inline-flex items-center px-1 pt-1 text-sm font-medium ${
      location.pathname.startsWith(path)
        ? "border-b-2 border-blue-500 text-white"
        : "text-slate-300 hover:text-white"
    }`

  const handleLogOut = () => {
    logout()
    navigate("/login")
  }

  return (
    <nav className="bg-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <img 
              src="https://avatars.githubusercontent.com/u/94191472?s=280&v=4"
              alt="Logo"
              className="h-12 w-12 brightness-0 invert"
            />
            <Link to="/dashboard" className={linkClass("/dashboard")}>
              Dashboard
            </Link>
            <Link to="/events" className={linkClass("/events")}>
              Events List
            </Link>
            <Link to="/check-in" className={linkClass("/check-in")}>
              Check-in
            </Link>
            <Link to="/audit" className={linkClass("/audit")}>
              Audit
            </Link>
          </div>
          <div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-slate-800 border-white hover:bg-slate-200 hover:text-slate-900"
              onClick={handleLogOut}
            >
              Log Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

