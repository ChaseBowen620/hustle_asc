import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function LoginPage() {
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const { login, isAdmin } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    
    try {
      // Convert identifier to proper format
      let username = identifier.toLowerCase()
      // If it's an email, extract the A-Number
      if (username.includes('@')) {
        username = username.split('@')[0]
      }
      // Remove any spaces
      username = username.trim()
      
      const userData = await login(username, password)
      
      // Redirect based on user role
      if (isAdmin(userData)) {
        navigate('/events')
      } else {
        navigate('/dashboard')
      }
    } catch (error) {
      setError("Invalid credentials")
      console.error('Login error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Sign In</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="A-Number or Email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            <Button type="submit" className="w-full">
              Sign In
            </Button>
            <p className="text-sm text-center text-gray-500">
              Don't have an account?{" "}
              <Link to="/register" className="text-blue-500 hover:text-blue-600">
                Create Account
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default LoginPage 