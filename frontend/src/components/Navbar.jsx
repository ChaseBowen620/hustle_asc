import { Link, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"

function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAdmin, logout } = useAuth()
  const userIsAdmin = isAdmin(user)

  const dashboardPath = userIsAdmin ? "/admin/dashboard" : "/dashboard"

  const linkClass = (path) =>
    `inline-flex items-center px-1 pt-1 text-sm font-medium ${
      location.pathname.startsWith(path)
        ? "border-b-2 border-blue-500 text-white"
        : "text-slate-300 hover:text-white"
    }`

  const handleSignOut = () => {
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
            <Link to={dashboardPath} className={linkClass(dashboardPath)}>
              Dashboard
            </Link>
            {userIsAdmin && (
              <Link to="/events" className={linkClass("/events")}>
                Events List
              </Link>
            )}
            {userIsAdmin && (
              <Link to="/check-in" className={linkClass("/check-in")}>
                Check In
              </Link>
            )}
            <Link to="/settings" className={linkClass("/settings")}>
              Settings
            </Link>
          </div>
          <div>
            <Button 
              variant="outline"
              size="sm"
              className="text-black border-white hover:bg-slate-700 hover:text-black"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar

