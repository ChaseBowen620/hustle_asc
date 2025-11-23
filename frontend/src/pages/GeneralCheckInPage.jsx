import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import axios from "axios"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { CheckCircle, XCircle, ArrowLeft, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { API_URL } from '@/config/api'

function GeneralCheckInPage() {
  const navigate = useNavigate()
  const { organization } = useParams()
  const [events, setEvents] = useState([])
  const [closestEvent, setClosestEvent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [aNumber, setANumber] = useState("")
  const [aNumberError, setANumberError] = useState("")
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [students, setStudents] = useState([])
  const [attendances, setAttendances] = useState([])
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUserData, setNewUserData] = useState({
    first_name: "",
    last_name: ""
  })
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const { toast } = useToast()

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/students/`)
      setStudents(response.data)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const fetchAttendances = async () => {
    if (!closestEvent) return
    try {
      const response = await axios.get(`${API_URL}/api/attendance/`)
      const eventAttendances = response.data.filter(
        attendance => attendance.event === closestEvent.id
      )
      setAttendances(eventAttendances)
    } catch (error) {
      console.error('Error fetching attendances:', error)
    }
  }

  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      const response = await axios.get(`${API_URL}/api/events/`)
      let allEvents = response.data
      
      // If organization is specified, filter events by that organization
      if (organization) {
        // Convert URL param to uppercase and normalize (remove spaces, special chars)
        const orgSlug = organization.toUpperCase().replace(/\s+/g, '')
        allEvents = allEvents.filter(event => {
          // Normalize event's primary organization for comparison
          const eventOrg = (event.organization || '').toUpperCase().replace(/\s+/g, '')
          if (eventOrg === orgSlug) return true
          
          // Check if event has this organization as a secondary organization
          if (event.event_organizations && Array.isArray(event.event_organizations)) {
            return event.event_organizations.some(eo => {
              const eoName = (eo.organization_name || eo.organization || '').toUpperCase().replace(/\s+/g, '')
              return eoName === orgSlug
            })
          }
          return false
        })
      }
      
      // Filter for today's events and sort by time
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const todaysEvents = allEvents.filter(event => {
        const eventDate = new Date(event.date)
        return eventDate >= today && eventDate < tomorrow
      }).sort((a, b) => new Date(a.date) - new Date(b.date))
      
      setEvents(todaysEvents)
      
      // Find the closest event (next upcoming event today)
      const now = new Date()
      const upcomingEvents = todaysEvents.filter(event => new Date(event.date) >= now)
      
      if (upcomingEvents.length > 0) {
        setClosestEvent(upcomingEvents[0])
      } else if (todaysEvents.length > 0) {
        // If no upcoming events, use the last event of the day
        setClosestEvent(todaysEvents[todaysEvents.length - 1])
      }
      
    } catch (error) {
      console.error('Error fetching events:', error)
      toast({
        title: "Error",
        description: "Failed to load events. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
    fetchStudents()
  }, [organization])

  useEffect(() => {
    if (closestEvent) {
      fetchAttendances()
    }
  }, [closestEvent])

  const validateANumber = (value) => {
    if (!value.trim()) {
      setANumberError("")
      return true
    }
    
    // Normalize the input (remove spaces, convert to lowercase for validation)
    const normalized = value.trim().toLowerCase().replace(/\s+/g, '')
    
    // Check format: 'a' followed by exactly 8 digits
    const aNumberPattern = /^a\d{8}$/
    
    if (!aNumberPattern.test(normalized)) {
      setANumberError("A-number must be in the format: a########")
      return false
    }
    
    setANumberError("")
    return true
  }

  const handleANumberChange = (e) => {
    const value = e.target.value.toUpperCase()
    setANumber(value)
    validateANumber(value)
  }

  const findStudentByANumber = (aNumberInput) => {
    // Normalize A-number input (remove spaces, convert to uppercase)
    const normalizedInput = aNumberInput.trim().toUpperCase().replace(/\s+/g, '')
    
    return students.find(student => {
      // Check username (which is typically the A-number)
      const username = (student.username || '').toUpperCase().replace(/\s+/g, '')
      if (username === normalizedInput) return true
      
      return false
    })
  }

  const handleCheckIn = async (e) => {
    e.preventDefault()
    
    if (!aNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter your A-number",
        variant: "destructive"
      })
      return
    }

    // Validate A-number format
    if (!validateANumber(aNumber)) {
      toast({
        title: "Invalid A-number",
        description: aNumberError || "A-number must be in the format: a########",
        variant: "destructive"
      })
      return
    }

    if (!closestEvent) {
      toast({
        title: "Error",
        description: "No event available for check-in",
        variant: "destructive"
      })
      return
    }

    // Check if student is already checked in
    const student = findStudentByANumber(aNumber)
    if (!student) {
      // Show create user form instead of error
      setShowCreateUser(true)
      return
    }

    // Check if already checked in
    const alreadyCheckedIn = attendances.some(
      attendance => attendance.student.id === student.id
    )
    
    if (alreadyCheckedIn) {
      toast({
        title: "Already Checked In",
        description: `${student.first_name} ${student.last_name} has already been checked in to this event.`,
        variant: "destructive"
      })
      setANumber("")
      setANumberError("")
      return
    }

    setIsCheckingIn(true)
    
    try {
      await axios.post(`${API_URL}/api/attendance/`, {
        student: student.id,
        event: closestEvent.id,
        points: closestEvent.points || 1
      })

      toast({
        title: "Success!",
        description: `Welcome ${student.first_name}! You've been checked in to ${closestEvent.name}.`,
        className: "bg-green-50 border-green-200 text-black",
      })
      
      // Refresh attendances
      await fetchAttendances()
      
      // Clear input and error
      setANumber("")
      setANumberError("")
    } catch (error) {
      console.error('Error checking in student:', error)
      let errorMessage = "Failed to check in. Please try again."
      
      if (error.response?.status === 400) {
        errorMessage = error.response.data.error || errorMessage
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsCheckingIn(false)
    }
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    
    if (!newUserData.first_name.trim() || !newUserData.last_name.trim()) {
      toast({
        title: "Error",
        description: "Please enter both first and last name",
        variant: "destructive"
      })
      return
    }

    if (!aNumber.trim()) {
      toast({
        title: "Error",
        description: "A-number is required",
        variant: "destructive"
      })
      return
    }

    if (!closestEvent) {
      toast({
        title: "Error",
        description: "No event available for check-in",
        variant: "destructive"
      })
      return
    }

    setIsCreatingUser(true)

    try {
      // Normalize A-number (lowercase)
      const normalizedANumber = aNumber.trim().toLowerCase().replace(/\s+/g, '')
      
      // Create user account
      const registerResponse = await axios.post(`${API_URL}/api/register/`, {
        first_name: newUserData.first_name.trim(),
        last_name: newUserData.last_name.trim(),
        a_number: normalizedANumber,
        password: "changeme!" // Default password
      })

      if (registerResponse.status === 201 || registerResponse.status === 200) {
        // Refresh students list to get the new student
        await fetchStudents()
        
        // Retry finding the student with multiple attempts (in case of timing issues)
        let newStudent = null
        let attempts = 0
        const maxAttempts = 5
        
        while (!newStudent && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300))
          newStudent = findStudentByANumber(aNumber)
          attempts++
          
          // If still not found, refresh students list again
          if (!newStudent && attempts < maxAttempts) {
            await fetchStudents()
          }
        }
        
        if (newStudent) {
          // Check them in
          try {
            await axios.post(`${API_URL}/api/attendance/`, {
              student: newStudent.id,
              event: closestEvent.id,
              points: closestEvent.points || 1
            })

            toast({
              title: "Success!",
              description: `Welcome ${newUserData.first_name}! Your account has been created and you've been checked in to ${closestEvent.name}.`,
              className: "bg-green-50 border-green-200 text-black",
            })
            
            // Refresh attendances
            await fetchAttendances()
            
            // Reset form
            setANumber("")
            setNewUserData({ first_name: "", last_name: "" })
            setShowCreateUser(false)
          } catch (checkInError) {
            console.error('Error checking in after account creation:', checkInError)
            toast({
              title: "Account Created",
              description: `Account created for ${newUserData.first_name} ${newUserData.last_name}, but check-in failed. Please try checking in again.`,
              variant: "destructive"
            })
            setANumber("")
            setNewUserData({ first_name: "", last_name: "" })
            setShowCreateUser(false)
          }
        } else {
          toast({
            title: "Account Created",
            description: `Account created for ${newUserData.first_name} ${newUserData.last_name}. Please try checking in again.`,
            className: "bg-green-50 border-green-200 text-black",
          })
          setANumber("")
          setNewUserData({ first_name: "", last_name: "" })
          setShowCreateUser(false)
        }
      }
    } catch (error) {
      console.error('Error creating user:', error)
      let errorMessage = "Failed to create account. Please try again."
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
    } finally {
      setIsCreatingUser(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    )
  }

  if (!closestEvent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Events Today</h1>
          <p className="text-gray-600 mb-4">There are no events scheduled for today.</p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Check In</h1>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">{closestEvent.name}</h2>
            <p className="text-gray-600">
              {format(new Date(closestEvent.date), 'EEEE, MMMM d, yyyy')} at {format(new Date(closestEvent.date), 'h:mm a')}
            </p>
            <p className="text-gray-500">{closestEvent.location}</p>
          </div>
        </div>

        {/* Check In Form */}
        {!showCreateUser ? (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <form onSubmit={handleCheckIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="a-number" className="text-base font-medium">
                  Enter Your A-Number
                </Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      id="a-number"
                      type="text"
                      placeholder="e.g., A01234567"
                      value={aNumber}
                      onChange={handleANumberChange}
                      className={`text-lg ${aNumberError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                      autoFocus
                      disabled={isCheckingIn}
                      maxLength={9}
                    />
                    {aNumberError && (
                      <p className="text-sm text-red-600 mt-1">{aNumberError}</p>
                    )}
                  </div>
                  <Button 
                    type="submit"
                    size="lg"
                    disabled={isCheckingIn || !aNumber.trim() || !!aNumberError}
                    className="gap-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    {isCheckingIn ? "Checking In..." : "Check In"}
                  </Button>
                </div>
                <p className="text-sm text-gray-500">
                  Enter your A-number to check in to {closestEvent.name}
                </p>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Create a new user</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-medium">
                  A-Number: {aNumber}
                </Label>
                <p className="text-sm text-gray-500 mb-4">
                  We couldn't find an account with this A-number. Please enter your name to create a new account.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    type="text"
                    placeholder="Enter first name"
                    value={newUserData.first_name}
                    onChange={(e) => setNewUserData({ ...newUserData, first_name: e.target.value })}
                    className="text-lg"
                    autoFocus
                    disabled={isCreatingUser}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    type="text"
                    placeholder="Enter last name"
                    value={newUserData.last_name}
                    onChange={(e) => setNewUserData({ ...newUserData, last_name: e.target.value })}
                    className="text-lg"
                    disabled={isCreatingUser}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateUser(false)
                    setNewUserData({ first_name: "", last_name: "" })
                    setANumber("")
                    setANumberError("")
                  }}
                  disabled={isCreatingUser}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={isCreatingUser || !newUserData.first_name.trim() || !newUserData.last_name.trim()}
                  className="flex-1 gap-2"
                >
                  <CheckCircle className="h-5 w-5" />
                  {isCreatingUser ? "Creating..." : "Create Account & Check In"}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* All Today's Events */}
        {events.length > 1 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Today's Events</h3>
              <p className="text-gray-600 text-sm">Click on any event to check in</p>
            </div>
            <div className="divide-y">
              {events.map((event) => (
                <div 
                  key={event.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/check-in/public/${event.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{event.name}</h4>
                      <p className="text-sm text-gray-600">
                        {format(new Date(event.date), 'h:mm a')} • {event.location}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {new Date(event.date) >= new Date() ? 'Upcoming' : 'Past'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GeneralCheckInPage






