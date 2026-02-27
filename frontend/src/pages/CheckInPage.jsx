import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import axios from "axios"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, ChevronLeft, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import CheckInStudents from "@/components/CheckInStudents"
import QRCodeGenerator from "@/components/QRCodeGenerator"
import CreateEvent from "@/components/CreateEvent"
import { API_URL } from "@/config/api"
import { isEventTodayMST, formatMSTDateString } from "@/utils/mstDate"

function CheckInPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [students, setStudents] = useState([])
  const [attendances, setAttendances] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEvent, setSelectedEvent] = useState(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const [showAllUpcoming, setShowAllUpcoming] = useState(false)
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)

  const fetchEvents = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events/?page_size=500`)
      const data = response.data
      setEvents(data.results ?? data ?? [])
    } catch (error) {
      console.error("Error fetching events:", error)
    }
  }, [])

  const fetchStudents = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/students/`)
      setStudents(Array.isArray(response.data) ? response.data : response.data.results ?? [])
    } catch (error) {
      console.error("Error fetching students:", error)
    }
  }, [])

  const fetchAttendances = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/attendance/`)
      setAttendances(response.data)
    } catch (error) {
      console.error("Error fetching attendances:", error)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    fetchStudents()
  }, [fetchEvents, fetchStudents])

  useEffect(() => {
    if (!eventId) return
    const event = events.find((e) => e.id === parseInt(eventId))
    if (event) {
      setSelectedEvent(event)
      return
    }
    axios.get(`${API_URL}/api/events/${eventId}/`).then((res) => {
      setSelectedEvent(res.data)
    }).catch(() => {})
  }, [eventId, events])

  useEffect(() => {
    if (selectedEvent) fetchAttendances()
  }, [selectedEvent, fetchAttendances])

  const handleUserCreated = useCallback(() => {
    fetchStudents()
  }, [fetchStudents])

  const handleCheckIn = useCallback(
    async (student) => {
      if (!selectedEvent) return
      setCheckingIn(true)
      try {
        await axios.post(
          `${API_URL}/api/attendance/`,
          { student: student.id, event: selectedEvent.id },
          { headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {} }
        )
        toast({
          title: "Checked in",
          description: `${student.first_name} ${student.last_name} has been checked in.`,
          className: "bg-green-50 border-green-200 text-black",
        })
        fetchAttendances()
      } catch (err) {
        const msg = err.response?.data?.error || err.message
        const alreadyCheckedIn = /already checked in|already exists/i.test(msg)
        toast({
          title: alreadyCheckedIn ? "Already checked in" : "Error",
          description: alreadyCheckedIn ? "This student is already checked in for this event." : msg,
          variant: "destructive",
        })
      } finally {
        setCheckingIn(false)
      }
    },
    [selectedEvent, toast, user?.token, fetchAttendances]
  )

  const handleNewUserAndCheckIn = useCallback(
    async (data) => {
      if (!selectedEvent) return
      setCheckingIn(true)
      try {
        const regRes = await axios.post(
          `${API_URL}/api/register/`,
          {
            first_name: data.first_name,
            last_name: data.last_name,
            a_number: data.a_number,
          },
          { headers: { "Content-Type": "application/json" } }
        )
        const studentId = regRes.data.student_id
        if (studentId == null) {
          toast({ title: "Error", description: "Registration did not return a student ID.", variant: "destructive" })
          return
        }
        await axios.post(
          `${API_URL}/api/attendance/`,
          { student: studentId, event: selectedEvent.id },
          { headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {} }
        )
        toast({
          title: "Checked in",
          description: `${data.first_name} ${data.last_name} has been added and checked in.`,
          className: "bg-green-50 border-green-200 text-black",
        })
        fetchStudents()
        fetchAttendances()
      } catch (err) {
        const msg = err.response?.data?.error || err.message
        toast({ title: "Error", description: msg, variant: "destructive" })
      } finally {
        setCheckingIn(false)
      }
    },
    [selectedEvent, toast, user?.token, fetchStudents, fetchAttendances]
  )

  const handleRemoveAttendance = useCallback(
    async (attendanceId) => {
      try {
        await axios.delete(`${API_URL}/api/attendance/${attendanceId}/`, {
          headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {},
        })
        toast({ title: "Removed", description: "Attendance removed." })
        fetchAttendances()
      } catch (err) {
        toast({
          title: "Error",
          description: err.response?.data?.error || "Failed to remove attendance",
          variant: "destructive",
        })
      }
    },
    [user?.token, fetchAttendances, toast]
  )

  const eventAttendances = (() => {
    const apiList = Array.isArray(attendances) ? attendances : []
    return selectedEvent ? apiList.filter((a) => Number(a.event) === Number(selectedEvent.id)) : []
  })()

  const handleCreateEvent = useCallback(
    async (payload) => {
      try {
        await axios.post(`${API_URL}/api/events/`, payload, {
          headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {},
        })
        toast({ title: "Event created", description: "Event has been created." })
        setShowCreateEventDialog(false)
        fetchEvents()
      } catch (err) {
        const msg = err.response?.data?.error || err.message
        toast({ title: "Error", description: msg, variant: "destructive" })
      }
    },
    [fetchEvents, toast, user?.token]
  )

  const handleEventSelect = (event) => {
    navigate(`/check-in/${event.id}`)
  }

  const handleBack = () => {
    setSelectedEvent(null)
    navigate("/check-in")
  }

  const eventOrganization = (e) => e.organization ?? ""

  const filteredEvents = events
    .filter((event) => {
      const eventDate = new Date(event.date)
      const now = new Date()
      if (showAllUpcoming) return eventDate >= now
      return isEventTodayMST(event.date)
    })
    .filter(
      (event) =>
        event.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eventOrganization(event).toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  return (
    <div className="space-y-6">
      {!selectedEvent ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-bold">Check In</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowCreateEventDialog(true)}
              >
                <Plus className="h-4 w-4" />
                Create event
              </Button>
              <QRCodeGenerator baseUrl={baseUrl} isGeneral scanPath="/scan" />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-gray-500" />
            <Input
              placeholder="Search events by name or organization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Today&apos;s Events (MST)</h2>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow
                      key={event.id}
                      onClick={() => handleEventSelect(event)}
                      className="cursor-pointer hover:bg-slate-100 active:bg-slate-200 transition-colors group"
                    >
                      <TableCell className="font-medium group-hover:text-slate-900">
                        {eventOrganization(event)}
                      </TableCell>
                      <TableCell className="group-hover:text-slate-900">{event.name}</TableCell>
                      <TableCell className="group-hover:text-slate-900">
                        {formatMSTDateString(event.date)}
                      </TableCell>
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

          <Dialog open={showCreateEventDialog} onOpenChange={setShowCreateEventDialog}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create event</DialogTitle>
              </DialogHeader>
              <CreateEvent onCreateEvent={handleCreateEvent} />
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Check In</h1>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Button variant="ghost" size="sm" className="gap-1" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4" />
                <span className="sm:hidden">Back</span>
                <span className="hidden sm:inline">Back to Events</span>
              </Button>
              <span className="hidden sm:inline text-slate-300">/</span>
              <span className="hidden sm:inline font-medium text-slate-900">{selectedEvent.name}</span>
            </div>
          </div>

          <p className="text-slate-500">
            {selectedEvent.name} • {formatMSTDateString(selectedEvent.date)}
          </p>

          <CheckInStudents
            students={students}
            onCheckIn={handleCheckIn}
            attendances={eventAttendances}
            selectedEvent={selectedEvent}
            onUserCreated={handleUserCreated}
            onNewUserAndCheckIn={handleNewUserAndCheckIn}
            onRemoveAttendance={handleRemoveAttendance}
            hideCheckedInList
            hideStudentList
            checkingIn={checkingIn}
          />
        </div>
      )}
    </div>
  )
}

export default CheckInPage
