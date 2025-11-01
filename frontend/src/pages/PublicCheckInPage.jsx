import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import axios from "axios"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, CheckCircle, XCircle, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { API_URL } from '@/config/api'
import CreateUserForm from "@/components/CreateUserForm"

function PublicCheckInPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [event, setEvent] = useState(null)
  const [students, setStudents] = useState([])
  const [attendances, setAttendances] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (eventId) {
      fetchEventData()
    }
  }, [eventId])

  const fetchEventData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch event details
      const eventResponse = await axios.get(`${API_URL}/api/events/${eventId}/`)
      setEvent(eventResponse.data)
      
      // Fetch students
      const studentsResponse = await axios.get(`${API_URL}/api/students/`)
      setStudents(studentsResponse.data)
      
      // Fetch attendances for this event
      const attendancesResponse = await axios.get(`${API_URL}/api/attendance/`)
      const eventAttendances = attendancesResponse.data.filter(
        attendance => attendance.event === parseInt(eventId)
      )
      setAttendances(eventAttendances)
      
    } catch (error) {
      console.error('Error fetching event data:', error)
      toast({
        title: "Error",
        description: "Failed to load event data. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Filter students who haven't checked in yet
  const availableStudents = students.filter(student => {
    return !attendances.some(
      attendance => 
        attendance.student.id === student.id && 
        attendance.event === parseInt(eventId)
    )
  })

  const filteredStudents = availableStudents.filter(student =>
    `${student.first_name} ${student.last_name} ${student.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCheckIn = async (student) => {
    if (!event) return
    
    setIsCheckingIn(true)
    
    try {
      const response = await axios.post(`${API_URL}/api/attendance/`, {
        student: student.id,
        event: parseInt(eventId),
        points: event.points || 1
      })

      if (response.status === 201) {
        toast({
          title: "Success!",
          description: `Welcome ${student.first_name}! You've been checked in to ${event.name}.`,
        })
        
        // Refresh attendances to update the list
        const attendancesResponse = await axios.get(`${API_URL}/api/attendance/`)
        const eventAttendances = attendancesResponse.data.filter(
          attendance => attendance.event === parseInt(eventId)
        )
        setAttendances(eventAttendances)
        
        // Clear search to show updated list
        setSearchTerm("")
      }
    } catch (error) {
      console.error('Error checking in student:', error)
      toast({
        title: "Error",
        description: "Failed to check in. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsCheckingIn(false)
    }
  }

  const handleUserCreated = () => {
    // Refresh the students list when a new user is created
    fetchStudents()
  }

  const fetchStudents = async () => {
    try {
      const studentsResponse = await axios.get(`${API_URL}/api/students/`)
      setStudents(studentsResponse.data)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  // Extract A-Number from email (assumes format: a12345678@usu.edu)
  const getANumber = (email) => {
    return email.split('@')[0].toUpperCase()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
          <p className="text-gray-600 mb-4">The event you're looking for doesn't exist or has been removed.</p>
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
            <h2 className="text-xl font-semibold text-gray-800">{event.name}</h2>
            <p className="text-gray-600">
              {format(new Date(event.date), 'EEEE, MMMM d, yyyy')} at {format(new Date(event.date), 'h:mm a')}
            </p>
            <p className="text-gray-500">{event.location}</p>
          </div>
        </div>

        {/* Check-in Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">How to Check In</h3>
              <p className="text-blue-800 text-sm">
                Search for your name below and click on it to check in. If you don't see your name, 
                please contact the event organizer.
              </p>
            </div>
          </div>
        </div>

        {/* Search and Student List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Search className="w-5 h-5 text-gray-500" />
                <Input
                  placeholder="Search for your name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <CreateUserForm onUserCreated={handleUserCreated} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>A-Number</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.first_name} {student.last_name}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {getANumber(student.email)}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={() => handleCheckIn(student)}
                        disabled={isCheckingIn}
                        size="sm"
                        className="gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        {isCheckingIn ? "Checking In..." : "Check In"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredStudents.length === 0 && searchTerm && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                      No students found matching "{searchTerm}"
                    </TableCell>
                  </TableRow>
                )}
                {filteredStudents.length === 0 && !searchTerm && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                      All students have been checked in for this event
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Event Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{attendances.length}</div>
            <div className="text-sm text-gray-600">Checked In</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{availableStudents.length}</div>
            <div className="text-sm text-gray-600">Available to Check In</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{students.length}</div>
            <div className="text-sm text-gray-600">Total Students</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PublicCheckInPage
