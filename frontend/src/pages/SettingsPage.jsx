import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import axios from "axios"
import { API_URL } from '@/config/api'
import QRCodeGenerator from "@/components/QRCodeGenerator"

function SettingsPage() {
  const [userInfo, setUserInfo] = useState(null)
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    fetchUserInfo()
  }, [])

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/user/me/`, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      })
      setUserInfo(response.data)
    } catch (error) {
      console.error('Error fetching user info:', error)
      toast({
        title: "Error",
        description: "Failed to load user information",
        variant: "destructive"
      })
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      await axios.post(`${API_URL}/api/user/change-password/`, passwordData, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      })
      
      toast({
        title: "Success",
        description: "Password changed successfully"
      })
      
      // Clear form
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: ""
      })
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to change password"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (!userInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading user information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600">Manage your account information and security</p>
        </div>

        {/* User Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>
              Your current account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Username</Label>
                <p className="text-lg font-medium">{userInfo.username}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Email</Label>
                <p className="text-lg font-medium">{userInfo.email}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">First Name</Label>
                <p className="text-lg font-medium">{userInfo.first_name || userInfo.admin_profile?.first_name || "Not set"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Last Name</Label>
                <p className="text-lg font-medium">{userInfo.last_name || userInfo.admin_profile?.last_name || "Not set"}</p>
              </div>
            </div>

            {userInfo.admin_profile && (
              <div>
                <Label className="text-sm font-medium text-gray-500">Role</Label>
                <p className="text-lg font-medium">{userInfo.admin_profile.role}</p>
              </div>
            )}

            <div>
              <Label className="text-sm font-medium text-gray-500">Account Type</Label>
              <p className="text-lg font-medium">
                {userInfo.is_admin ? "Administrator" : "Student"}
                {userInfo.is_superuser && " (Super User)"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Password Change Card */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <Input
                  id="current_password"
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => handleInputChange('current_password', e.target.value)}
                  placeholder="Enter your current password"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => handleInputChange('new_password', e.target.value)}
                  placeholder="Enter your new password"
                  required
                />
                <p className="text-sm text-gray-500">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                  placeholder="Confirm your new password"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? "Changing Password..." : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* QR Code Generator Card - Only for Admin Users */}
        {userInfo.is_admin && (
          <Card>
            <CardHeader>
              <CardTitle>Check-In QR Code</CardTitle>
              <CardDescription>
                Generate a QR code for students to check in to events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This QR code will direct students to a general check-in page that automatically 
                  finds the closest available event for today.
                </p>
                <div className="flex justify-center">
                  <QRCodeGenerator isGeneral={true} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default SettingsPage
