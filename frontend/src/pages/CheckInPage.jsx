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
import { Search, ChevronLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import CheckInStudents from "@/components/CheckInStudents"
import { API_URL } from '@/config/api'

function CheckInPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [students, setStudents] = useState([])
  const [attendances, setAttendances] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEvent, setSelectedEvent] = useState(null)
  const { toast } = useToast()
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)

  useEffect(() => {
    fetchEvents()
    fetchStudents()
  }, [])

  useEffect(() => {
    if (eventId) {
      const event = events.find(e => e.id === parseInt(eventId))
      if (event) {
        setSelectedEvent(event)
      }
    }
  }, [eventId, events])

  useEffect(() => {
    if (selectedEvent) {
      fetchAttendances()
    }
  }, [selectedEvent])

  useEffect(() => {
    if (!eventId) {
      setSelectedEvent(null)
    }
  }, [eventId])

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events/`)
      setEvents(response.data)
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/students/`)
      setStudents(response.data)
    } catch (error) {
      console.error('Error fetching students:', error)
    }
  }

  const fetchAttendances = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/attendance/`)
      setAttendances(response.data)
    } catch (error) {
      console.error('Error fetching attendances:', error)
    }
  }

  const handleCheckIn = async (student) => {
    try {
      await axios.post(`${API_URL}/api/attendance/`, {
        student: student.id,
        event: selectedEvent.id
      })

      toast({
        title: "Success",
        description: `${student.first_name} ${student.last_name} has been checked in.`,
        className: "bg-green-50 border-green-200 text-black",
      })

      fetchAttendances()

    } catch (error) {
      console.error('Error checking in student:', error)
      
      let errorMessage = 'Failed to check in student.'
      
      if (error.response) {
        if (error.response.status === 400 && error.response.data.error === 'Student already checked in') {
          errorMessage = `${student.first_name} ${student.last_name} has already been checked in for this event.`
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-black",
      })
    }
  }

  const handleEventSelect = (event) => {
    navigate(`/check-in/${event.id}`)
  }

  const handleBack = () => {
    setSelectedEvent(null)
    navigate('/check-in')
  }

  const filteredEvents = events
    .filter(event => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const eventDate = new Date(event.date)
      const now = new Date()
      
      if (showAllUpcoming) {
        return eventDate >= now // Show all future events
      } else {
        return eventDate >= today && eventDate < tomorrow // Show only today's events
      }
    })
    .filter(event =>
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.event_type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  return (
    <div className="space-y-6">
      {!selectedEvent ? (
        <>
          <h1 className="text-3xl font-bold">Check In</h1>
          
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-gray-500" />
            <Input
              placeholder="Search events by name, type, or location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Points</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow 
                      key={event.id}
                      onClick={() => handleEventSelect(event)}
                      className="cursor-pointer hover:bg-slate-100 active:bg-slate-200 transition-colors group"
                    >
                      <TableCell className="font-medium group-hover:text-slate-900">{event.event_type}</TableCell>
                      <TableCell className="group-hover:text-slate-900">{event.name}</TableCell>
                      <TableCell className="group-hover:text-slate-900">
                        {format(new Date(event.date), 'h:mm a')}
                      </TableCell>
                      <TableCell className="group-hover:text-slate-900">{event.location}</TableCell>
                      <TableCell className="group-hover:text-slate-900">{event.points}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <Button
              variant="outline"
              onClick={() => setShowAllUpcoming(!showAllUpcoming)}
              className="w-full"
            >
              {showAllUpcoming ? "Show Today's Events Only" : "Show All Upcoming Events"}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Check In</h1>
            
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={handleBack}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sm:hidden">Back</span>
                <span className="hidden sm:inline">Back to Events</span>
              </Button>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="hidden sm:inline font-medium text-slate-900">{selectedEvent.name}</span>
            </div>
          </div>
          
          <p className="text-slate-500">
            {selectedEvent.name} • {format(new Date(selectedEvent.date), 'MMMM d, yyyy')}
          </p>
          
          <CheckInStudents
            students={students}
            onCheckIn={handleCheckIn}
            attendances={attendances}
            selectedEvent={selectedEvent}
          />
        </div>
      )}
    </div>
  )
}

export default CheckInPage
