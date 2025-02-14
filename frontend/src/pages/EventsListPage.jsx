import { useState, useEffect } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Search, MoreVertical, ClipboardList } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import CreateEvent from "@/components/CreateEvent"
import { API_URL } from '@/config/api'

function EventsListPage() {
  const [events, setEvents] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
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

  const handleCreateEvent = async (newEvent) => {
    try {
      const response = await axios.post(`${API_URL}/api/events/`, {
        name: newEvent.name,
        description: newEvent.description || "",
        date: newEvent.date,
        location: newEvent.location,
        points: parseInt(newEvent.points)
      })
      setEvents([...events, response.data])
      setShowCreateDialog(false)
    } catch (error) {
      console.error('Error creating event:', error)
    }
  }

  const handleEditEvent = async (updatedEvent) => {
    try {
      const response = await axios.put(`${API_URL}/api/events/${editingEvent.id}/`, {
        name: updatedEvent.name,
        description: updatedEvent.description || "",
        date: updatedEvent.date,
        location: updatedEvent.location,
        points: parseInt(updatedEvent.points)
      })
      setEvents(events.map(event => 
        event.id === editingEvent.id ? response.data : event
      ))
      setEditingEvent(null)
    } catch (error) {
      console.error('Error updating event:', error)
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await axios.delete(`${API_URL}/api/events/${eventId}/`)
        setEvents(events.filter(event => event.id !== eventId))
      } catch (error) {
        console.error('Error deleting event:', error)
      }
    }
  }

  const handleDownloadCSV = (event) => {
    // Create CSV content
    const csvContent = [
      `${event.name},${format(new Date(event.date), 'M/d/yy')}`,
      'First Name,Last Name,Check-in Time',
      ...event.attendees
        .sort((a, b) => 
          `${a.student.last_name} ${a.student.first_name}`
            .localeCompare(`${b.student.last_name} ${b.student.first_name}`)
        )
        .map(record => 
          `${record.student.first_name},${record.student.last_name},${format(new Date(record.checked_in_at), 'h:mm a')}`
        )
    ].join('\n')

    // Create filename
    const eventDate = format(new Date(event.date), 'M/d/yy')
    const filename = `${event.name}_Attendance_${eventDate}.csv`
      .replace(/[/\\?%*:|"<>]/g, '-')

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredEvents = events
    .filter(event => 
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <div className="min-h-screen bg-background px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Events</h1>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>Create Event</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <CreateEvent onCreateEvent={handleCreateEvent} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-500" />
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Points</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead className="w-[70px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-medium">{event.name}</TableCell>
                  <TableCell>{format(new Date(event.date), 'MMM d, yyyy h:mm a')}</TableCell>
                  <TableCell>{event.location}</TableCell>
                  <TableCell>{event.points}</TableCell>
                  <TableCell>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="bg-slate-50 hover:bg-slate-300 transition-colors"
                      onClick={() => {
                        setSelectedEvent(event)
                        setShowAttendees(true)
                      }}
                    >
                      {event.attendees?.length || 0} <ClipboardList className="h-4 w-4 inline ml-1" />
                    </Button>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingEvent(event)}>
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteEvent(event.id)}
                          className="text-red-600"
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Edit Event Dialog */}
        <Dialog open={!!editingEvent} onOpenChange={() => setEditingEvent(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Event</DialogTitle>
            </DialogHeader>
            <CreateEvent 
              onCreateEvent={handleEditEvent}
              initialData={editingEvent}
            />
          </DialogContent>
        </Dialog>

        {/* Attendance Dialog */}
        <Dialog open={showAttendees} onOpenChange={setShowAttendees}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {selectedEvent?.name} - Attendance Details
              </DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Check-in Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedEvent?.attendees
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
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleDownloadCSV(selectedEvent)}
                className="bg-slate-50 hover:bg-slate-300"
              >
                Download
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

export default EventsListPage 