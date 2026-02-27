import { Link, useLocation } from "react-router-dom"

function Navbar() {
  const location = useLocation()

  const linkClass = (path) =>
    `inline-flex items-center px-1 pt-1 text-sm font-medium ${
      location.pathname.startsWith(path)
        ? "border-b-2 border-blue-500 text-white"
        : "text-slate-300 hover:text-white"
    }`

  return (
    <nav className="bg-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex h-16 items-center space-x-8">
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
      </div>
    </nav>
  )
}

export default Navbar

