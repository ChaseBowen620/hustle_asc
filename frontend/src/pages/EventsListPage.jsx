import { useState, useEffect } from "react"
import axios from "axios"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Search, ClipboardList } from "lucide-react"
import { API_URL } from '@/config/api'

function EventsListPage() {
  const [events, setEvents] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showAttendees, setShowAttendees] = useState(false)

  useEffect(() => {
    fetchEvents()
  }, [])


  const fetchEvents = async () => {
    try {
      const [eventsRes, attendanceRes] = await Promise.all([
        axios.get(`${API_URL}/api/events/`),
        axios.get(`${API_URL}/api/attendance/`)
      ])

      // Group attendance by event
      const eventsWithAttendance = eventsRes.data.map(event => ({
        ...event,
        attendees: attendanceRes.data
          .filter(record => record.event === event.id)
          .map(record => ({
            ...record,
            student: record.student,
            checked_in_at: new Date(record.checked_in_at)
          }))
      }))

      setEvents(eventsWithAttendance)
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }



  const filteredEvents = events
    .filter(event => 
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.event_type.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      // Descending for past events (most recent first)
      return dateB - dateA
    })

  const EventsTable = ({ events, showAttendance }) => (
    <Table>
      <TableHeader>
        <TableRow>
            <TableHead>Organization</TableHead>
            <TableHead>Event Type</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="hidden sm:table-cell">Recurrence Type</TableHead>
            <TableHead className="hidden sm:table-cell">Location</TableHead>
            {showAttendance && <TableHead>Attendance</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell className="font-medium">{event.organization}</TableCell>
            <TableCell>{event.event_type}</TableCell>
            <TableCell>{event.name}</TableCell>
            <TableCell>
              <span className="sm:hidden">
                {format(new Date(event.date), 'MMM d, yyyy')}
              </span>
              <span className="hidden sm:inline">
                {format(new Date(event.date), 'MMM d, yyyy h:mm a')}
              </span>
            </TableCell>
            <TableCell className="hidden sm:table-cell">
              {event.is_recurring && event.recurrence_type && event.recurrence_type !== 'none' ? (
                event.recurrence_type === 'daily' ? 'Daily' :
                event.recurrence_type === 'weekly' ? 'Weekly' :
                event.recurrence_type === 'biweekly' ? 'Every 2 Weeks' :
                event.recurrence_type === 'monthly' ? 'Monthly' :
                event.recurrence_type
              ) : '—'}
            </TableCell>
            <TableCell className="hidden sm:table-cell">{event.location}</TableCell>
            {showAttendance && (
              <TableCell>
                <button
                  className={`${event.attendees?.length > 0 
                    ? "bg-slate-50 hover:bg-slate-300 transition-colors px-3 py-1 rounded border"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed px-3 py-1 rounded border"
                  }`}
                  onClick={() => {
                    if (event.attendees?.length > 0) {
                      setSelectedEvent(event)
                      setShowAttendees(true)
                    }
                  }}
                  disabled={!event.attendees?.length}
                >
                  {event.attendees?.length || 0} <ClipboardList className="h-4 w-4 inline ml-1" />
                </button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Events</h1>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="w-5 h-5 text-gray-500" />
        <Input
          placeholder="Search by name, organization, or event type..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg">
        <EventsTable events={filteredEvents} showAttendance={true} />
      </div>

      {/* Attendance Dialog */}
      <Dialog open={showAttendees} onOpenChange={setShowAttendees}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent?.name} - Attendance Details
            </DialogTitle>
            <DialogDescription>
              View attendance for this event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Current Attendees Table */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Checked In Students ({selectedEvent?.attendees?.length || 0})</h3>
              {selectedEvent?.attendees && selectedEvent.attendees.length > 0 ? (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Check-in Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedEvent.attendees
                        .sort((a, b) => 
                          `${a.student.last_name} ${a.student.first_name}`
                            .localeCompare(`${b.student.last_name} ${b.student.first_name}`)
                        )
                        .map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              {record.student.first_name} {record.student.last_name}
                            </TableCell>
                            <TableCell>
                              {format(record.checked_in_at, 'h:mm a')}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-gray-500">No students checked in yet</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EventsListPage 