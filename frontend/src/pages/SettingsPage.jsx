import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  
  // Admin Management state
  const [showOrganizationsDialog, setShowOrganizationsDialog] = useState(false)
  const [showStudentLeadersDialog, setShowStudentLeadersDialog] = useState(false)
  const [showFacultyDialog, setShowFacultyDialog] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [newOrganizationName, setNewOrganizationName] = useState("")
  const [isCreatingOrg, setIsCreatingOrg] = useState(false)
  const [studentLeaders, setStudentLeaders] = useState([])
  const [faculty, setFaculty] = useState([])
  const [studentSearchQuery, setStudentSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [newRole, setNewRole] = useState("")
  const [isAssigningRole, setIsAssigningRole] = useState(false)
  const [facultyFormData, setFacultyFormData] = useState({
    first_name: "",
    last_name: "",
    email: ""
  })
  const [isCreatingFaculty, setIsCreatingFaculty] = useState(false)

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

  // Check if user is eligible for admin management
  const canManageAdmin = userInfo?.admin_profile?.role && 
    ['Super Admin', 'DAISSA', 'Faculty'].includes(userInfo.admin_profile.role)

  // Fetch organizations
  const fetchOrganizations = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/organizations/`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      setOrganizations(response.data)
    } catch (error) {
      console.error('Error fetching organizations:', error)
      toast({
        title: "Error",
        description: "Failed to load organizations",
        variant: "destructive"
      })
    }
  }

  // Create new organization
  const handleCreateOrganization = async () => {
    if (!newOrganizationName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive"
      })
      return
    }

    setIsCreatingOrg(true)
    try {
      const response = await axios.post(`${API_URL}/api/organizations/`, {
        name: newOrganizationName.trim()
      }, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      toast({
        title: "Success",
        description: "Organization created successfully"
      })
      setNewOrganizationName("")
      fetchOrganizations()
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to create organization"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsCreatingOrg(false)
    }
  }

  // Delete organization
  const handleDeleteOrganization = async (orgId) => {
    if (!confirm("Are you sure you want to delete this organization?")) {
      return
    }

    try {
      await axios.delete(`${API_URL}/api/organizations/${orgId}/`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      toast({
        title: "Success",
        description: "Organization deleted successfully"
      })
      fetchOrganizations()
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to delete organization"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  // Fetch student leaders (admin users except faculty)
  const fetchStudentLeaders = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin-users/`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      const leaders = response.data.filter(admin => admin.role !== 'Faculty')
      setStudentLeaders(leaders)
    } catch (error) {
      console.error('Error fetching student leaders:', error)
      toast({
        title: "Error",
        description: "Failed to load student leaders",
        variant: "destructive"
      })
    }
  }

  // Search students
  const handleStudentSearch = async (query) => {
    setStudentSearchQuery(query)
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    try {
      const response = await axios.get(`${API_URL}/api/students/search/?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      setSearchResults(response.data)
    } catch (error) {
      console.error('Error searching students:', error)
      setSearchResults([])
    }
  }

  // Assign role to student
  const handleAssignRole = async () => {
    if (!selectedStudent || !newRole.trim()) {
      toast({
        title: "Error",
        description: "Please select a student and enter a role",
        variant: "destructive"
      })
      return
    }

    setIsAssigningRole(true)
    try {
      await axios.post(`${API_URL}/api/admin-users/create/`, {
        student_id: selectedStudent.id,
        role: newRole.trim()
      }, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      toast({
        title: "Success",
        description: "Role assigned successfully"
      })
      setSelectedStudent(null)
      setNewRole("")
      setStudentSearchQuery("")
      setSearchResults([])
      fetchStudentLeaders()
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to assign role"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsAssigningRole(false)
    }
  }

  // Delete admin user (student leader or faculty)
  const handleDeleteAdminUser = async (adminUserId) => {
    if (!confirm("Are you sure you want to remove this admin user?")) {
      return
    }

    try {
      await axios.delete(`${API_URL}/api/admin-users/${adminUserId}/delete/`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      toast({
        title: "Success",
        description: "Admin user removed successfully"
      })
      fetchStudentLeaders()
      fetchFaculty()
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to remove admin user"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    }
  }

  // Fetch faculty
  const fetchFaculty = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin-users/`, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      const facultyList = response.data.filter(admin => admin.role === 'Faculty')
      setFaculty(facultyList)
    } catch (error) {
      console.error('Error fetching faculty:', error)
      toast({
        title: "Error",
        description: "Failed to load faculty",
        variant: "destructive"
      })
    }
  }

  // Create faculty
  const handleCreateFaculty = async (e) => {
    e.preventDefault()
    if (!facultyFormData.first_name || !facultyFormData.last_name || !facultyFormData.email) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive"
      })
      return
    }

    setIsCreatingFaculty(true)
    try {
      await axios.post(`${API_URL}/api/admin-users/create/`, {
        role: 'Faculty',
        first_name: facultyFormData.first_name,
        last_name: facultyFormData.last_name,
        email: facultyFormData.email
      }, {
        headers: { 'Authorization': `Bearer ${user?.token}` }
      })
      toast({
        title: "Success",
        description: "Faculty member created successfully"
      })
      setFacultyFormData({ first_name: "", last_name: "", email: "" })
      fetchFaculty()
    } catch (error) {
      const errorMessage = error.response?.data?.error || "Failed to create faculty member"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsCreatingFaculty(false)
    }
  }

  // Fetch data when dialogs open
  useEffect(() => {
    if (showOrganizationsDialog) {
      fetchOrganizations()
    }
  }, [showOrganizationsDialog])

  useEffect(() => {
    if (showStudentLeadersDialog) {
      fetchStudentLeaders()
    }
  }, [showStudentLeadersDialog])

  useEffect(() => {
    if (showFacultyDialog) {
      fetchFaculty()
    }
  }, [showFacultyDialog])

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
                <Label className="text-sm font-medium text-gray-500">First Name</Label>
                <p className="text-lg font-medium">{userInfo.first_name || userInfo.admin_profile?.first_name || "Not set"}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Last Name</Label>
                <p className="text-lg font-medium">{userInfo.last_name || userInfo.admin_profile?.last_name || "Not set"}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Username</Label>
                <p className="text-lg font-medium">{userInfo.username}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Role</Label>
                <p className="text-lg font-medium">
                  {userInfo.admin_profile?.role || (userInfo.is_admin ? "Administrator" : "Student")}
                  {userInfo.is_superuser && " (Super User)"}
                </p>
              </div>
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
              <CardTitle>Check-In QR Codes</CardTitle>
              <CardDescription>
                Generate QR codes for students to check in to organization-specific events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userInfo.admin_profile?.role ? (
                  <>
                    <p className="text-sm text-gray-600">
                      Generate a QR code for your organization ({userInfo.admin_profile.role}). 
                      Students scanning this code will see events for your organization.
                    </p>
                    <div className="flex justify-center">
                      <QRCodeGenerator organization={userInfo.admin_profile.role} />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      This QR code will direct students to a general check-in page that automatically 
                      finds the closest available event for today.
                    </p>
                    <div className="flex justify-center">
                      <QRCodeGenerator isGeneral={true} />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Management Card - Only for Super Admin, DAISSA, or Faculty */}
        {canManageAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Management</CardTitle>
              <CardDescription>
                Manage organizations, student leaders, and faculty
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={() => setShowOrganizationsDialog(true)} className="flex-1">
                  View Organizations
                </Button>
                <Button onClick={() => setShowStudentLeadersDialog(true)} className="flex-1">
                  View Student Leaders
                </Button>
                <Button onClick={() => setShowFacultyDialog(true)} className="flex-1" variant="default">
                  View Faculty
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Organizations Dialog */}
      <Dialog open={showOrganizationsDialog} onOpenChange={setShowOrganizationsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Organizations</DialogTitle>
            <DialogDescription>Manage organizations in the system</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Current Organizations Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Current Organizations</h3>
              {organizations.length === 0 ? (
                <p className="text-gray-500">No organizations found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {organizations.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell>{org.id}</TableCell>
                        <TableCell>{org.name || org}</TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteOrganization(org.id)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Create New Organization */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Create New Organization</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Organization name"
                  value={newOrganizationName}
                  onChange={(e) => setNewOrganizationName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateOrganization()}
                />
                <Button onClick={handleCreateOrganization} disabled={isCreatingOrg}>
                  {isCreatingOrg ? "Creating..." : "Create"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Student Leaders Dialog */}
      <Dialog open={showStudentLeadersDialog} onOpenChange={setShowStudentLeadersDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Student Leaders</DialogTitle>
            <DialogDescription>View and assign student leader roles</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Current Student Leaders Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Current Student Leaders</h3>
              {studentLeaders.length === 0 ? (
                <p className="text-gray-500">No student leaders found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentLeaders.map((leader) => (
                      <TableRow key={leader.id}>
                        <TableCell>{leader.first_name} {leader.last_name}</TableCell>
                        <TableCell>{leader.email}</TableCell>
                        <TableCell>{leader.role}</TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteAdminUser(leader.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Assign Role to Student */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Assign Role to Student</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Search Student (by name or A-number)</Label>
                  <Input
                    placeholder="Type to search..."
                    value={studentSearchQuery}
                    onChange={(e) => handleStudentSearch(e.target.value)}
                  />
                  {searchResults.length > 0 && !selectedStudent && (
                    <div className="border rounded-md max-h-48 overflow-y-auto">
                      {searchResults.map((student) => (
                        <div
                          key={student.id}
                          className={`p-2 cursor-pointer hover:bg-gray-100 ${
                            selectedStudent?.id === student.id ? 'bg-blue-100' : ''
                          }`}
                          onClick={() => {
                            setSelectedStudent(student)
                            setSearchResults([])
                          }}
                        >
                          <div className="font-medium">
                            {student.first_name} {student.last_name}
                          </div>
                          <div className="text-sm text-gray-500">
                            A-Number: {student.a_number || student.username || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedStudent && (
                    <p className="text-sm text-gray-600">
                      Selected: {selectedStudent.first_name} {selectedStudent.last_name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    placeholder="Enter role name"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                  />
                </div>
                <Button onClick={handleAssignRole} disabled={isAssigningRole || !selectedStudent || !newRole.trim()}>
                  {isAssigningRole ? "Assigning..." : "Assign Role"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Faculty Dialog */}
      <Dialog open={showFacultyDialog} onOpenChange={setShowFacultyDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Faculty</DialogTitle>
            <DialogDescription>View and create faculty members</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Current Faculty Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Current Faculty</h3>
              {faculty.length === 0 ? (
                <p className="text-gray-500">No faculty members found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faculty.map((fac) => (
                      <TableRow key={fac.id}>
                        <TableCell>{fac.first_name} {fac.last_name}</TableCell>
                        <TableCell>{fac.email}</TableCell>
                        <TableCell>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteAdminUser(fac.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Create New Faculty */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold mb-4">Create New Faculty Member</h3>
              <form onSubmit={handleCreateFaculty} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="faculty-first-name">First Name</Label>
                  <Input
                    id="faculty-first-name"
                    type="text"
                    value={facultyFormData.first_name}
                    onChange={(e) => setFacultyFormData({...facultyFormData, first_name: e.target.value})}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faculty-last-name">Last Name</Label>
                  <Input
                    id="faculty-last-name"
                    type="text"
                    value={facultyFormData.last_name}
                    onChange={(e) => setFacultyFormData({...facultyFormData, last_name: e.target.value})}
                    placeholder="Enter last name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="faculty-email">Email</Label>
                  <Input
                    id="faculty-email"
                    type="email"
                    value={facultyFormData.email}
                    onChange={(e) => setFacultyFormData({...facultyFormData, email: e.target.value})}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={!facultyFormData.first_name || !facultyFormData.last_name || !facultyFormData.email || isCreatingFaculty}>
                    {isCreatingFaculty ? "Creating..." : "Create Faculty"}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SettingsPage
