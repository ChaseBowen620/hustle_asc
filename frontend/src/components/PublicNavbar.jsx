import { Link, useLocation } from "react-router-dom"
import { Button } from "@/components/ui/button"

function PublicNavbar() {
  const location = useLocation()

  return (
    <nav className="bg-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex space-x-8">
            <Link
              to="/"
              className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                location.pathname === "/" 
                  ? "border-b-2 border-blue-500 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Home
            </Link>
            <Link
              to="/about"
              className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                location.pathname === "/about"
                  ? "border-b-2 border-blue-500 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              About Us
            </Link>
          </div>
          <Link to="/login">
            <Button 
              variant="outline"
              size="sm"
              className="text-black border-white hover:bg-slate-700"
            >
              Sign In
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}

export default PublicNavbar 