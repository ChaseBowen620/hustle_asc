import { Link, useLocation, useNavigate } from "react-router-dom"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import axios from "axios"

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

  return (
    <nav className="bg-slate-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex space-x-8">
            <Link
              to="/events"
              className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                location.pathname === "/events" 
                  ? "border-b-2 border-blue-500 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Events
            </Link>
            <Link
              to="/attendance"
              className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                location.pathname === "/attendance"
                  ? "border-b-2 border-blue-500 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Attendance
            </Link>
            <Link
              to="/positions"
              className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                location.pathname === "/positions"
                  ? "border-b-2 border-blue-500 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Positions
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-500 text-white">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleSignOut}
              className="text-black border-white hover:bg-slate-700"
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