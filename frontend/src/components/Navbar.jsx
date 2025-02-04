import { Link, useLocation, useNavigate } from "react-router-dom"
import { Button } from "./ui/button"
import axios from "axios"
import { Menu } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"

function Navbar({ updateUser }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || 'null')

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
  }

  const handleSignOut = () => {
    delete axios.defaults.headers.common['Authorization']
    localStorage.removeItem('user')
    updateUser(null)
    navigate('/')
  }

  if (!user) return null

  const navLinks = [
    { path: "/events", label: "Events" },
    { path: "/attendance", label: "Attendance" },
    { path: "/positions", label: "Positions" },
  ]

  return (
    <nav className="bg-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-slate-300 hover:text-white">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-slate-800 p-0">
                <SheetHeader className="p-6 border-b border-slate-700">
                  <SheetTitle className="text-white">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col space-y-1 p-6">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`px-4 py-2 rounded-md text-sm font-medium ${
                        location.pathname === link.path
                          ? "bg-slate-700 text-white"
                          : "text-slate-300 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <Button 
                    onClick={handleSignOut}
                    variant="ghost"
                    className="justify-start px-4 text-red-400 hover:text-red-300 hover:bg-slate-700"
                  >
                    Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                  location.pathname === link.path 
                    ? "border-b-2 border-blue-500 text-white"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Sign Out Button (Desktop) */}
          <div className="hidden md:block">
            <Button 
              onClick={handleSignOut}
              variant="ghost"
              className="text-slate-300 hover:text-white"
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