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
import { cn } from "../lib/utils"
import { useAuth } from "@/hooks/useAuth"
import { useState } from "react"

function Navbar() {
  const { user, logout, isAdmin } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const userIsAdmin = isAdmin(user)
  const [isOpen, setIsOpen] = useState(false)

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
    logout()
    navigate('/')
  }

  const handleNavigation = (path) => {
    setIsOpen(false)
    navigate(path)
  }

  if (!userIsAdmin) {
    return (
      <nav className="bg-slate-800 text-white md:fixed md:top-0 md:left-0 md:right-0 md:z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center">
              <img 
                src="https://avatars.githubusercontent.com/u/94191472?s=280&v=4"
                alt="Logo"
                className="h-16 w-16 brightness-0 invert"
              />
            </div>
            <Button 
              onClick={handleSignOut}
              variant="outline"
              size="sm"
              className="text-black border-white hover:bg-slate-700 hover:text-black"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </nav>
    )
  }

  // Return full navbar for admin
  const navLinks = [
    { path: "/admin/dashboard", label: "Dashboard" },
    { path: "/events", label: "Events List" },
    { path: "/check-in", label: "Check In" },
    { path: "/admin", label: "Admin" },
  ]

  return (
    <>
      <nav className="bg-slate-800 relative md:fixed md:top-0 md:left-0 md:right-0 md:z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between h-20 items-center">
            <div className="flex items-center">
              <img 
                src="https://avatars.githubusercontent.com/u/94191472?s=280&v=4"
                alt="Logo"
                className="h-14 w-14 brightness-0 invert"
              />
              
              {/* Desktop Menu - Now directly next to logo */}
              <div className="hidden md:flex space-x-8 ml-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={cn(
                      "text-sm font-medium transition-colors hover:text-white",
                      location.pathname === link.path
                        ? "text-white"
                        : "text-neutral-400"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Mobile Menu */}
            <div className="md:hidden">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
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
                      <Button
                        key={link.path}
                        onClick={() => handleNavigation(link.path)}
                        variant="ghost"
                        className={`justify-start px-4 ${
                          location.pathname === link.path
                            ? "bg-slate-700 text-white"
                            : "text-slate-300 hover:bg-slate-700 hover:text-white"
                        }`}
                      >
                        {link.label}
                      </Button>
                    ))}
                    <Button 
                      onClick={() => {
                        setIsOpen(false)
                        handleSignOut()
                      }}
                      variant="ghost"
                      className="justify-start px-4 text-red-400 hover:text-red-300 hover:bg-slate-700"
                    >
                      Sign Out
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Sign Out Button (Desktop) */}
            <div className="hidden md:block">
              <Button 
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="text-black border-white hover:bg-slate-700 hover:text-black"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>
      <div className="hidden md:block h-20" />
    </>
  )
}

export default Navbar 