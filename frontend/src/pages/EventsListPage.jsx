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
import { Search, ClipboardList, Edit2, Check, X, Trash2, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { API_URL } from '@/config/api'
import { useToast } from "@/hooks/use-toast"

function EventsListPage() {
  const [events, setEvents] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showAttendees, setShowAttendees] = useState(false)
  const [editingEventId, setEditingEventId] = useState(null)
  const [editValues, setEditValues] = useState({
    organization: "",
    name: "",
    date: ""
  })
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

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



  const handleEditClick = (event) => {
    setEditingEventId(event.id)
    // Format date for input (YYYY-MM-DDTHH:mm) - preserve local time
    const eventDate = new Date(event.date)
    // Get local date/time components without timezone conversion
    const year = eventDate.getFullYear()
    const month = String(eventDate.getMonth() + 1).padStart(2, '0')
    const day = String(eventDate.getDate()).padStart(2, '0')
    const hours = String(eventDate.getHours()).padStart(2, '0')
    const minutes = String(eventDate.getMinutes()).padStart(2, '0')
    const dateString = `${year}-${month}-${day}T${hours}:${minutes}`
    setEditValues({
      organization: event.organization,
      name: event.name,
      date: dateString
    })
  }

  const handleCancelEdit = () => {
    setEditingEventId(null)
    setEditValues({
      organization: "",
      name: "",
      date: ""
    })
  }

  const handleSaveEdit = async (eventId) => {
    if (!editValues.organization.trim()) {
      toast({
        title: "Error",
        description: "Event type cannot be empty",
        variant: "destructive"
      })
      return
    }

    if (!editValues.name.trim()) {
      toast({
        title: "Error",
        description: "Event name cannot be empty",
        variant: "destructive"
      })
      return
    }

    if (!editValues.date) {
      toast({
        title: "Error",
        description: "Event date is required",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)
    try {
      // Format date for API - preserve the date/time values as-is
      // The date and time inputs give us local values, we'll send them directly
      // Parse the date string (format: YYYY-MM-DDTHH:mm)
      const [datePart, timePart] = editValues.date.split('T')
      const [year, month, day] = datePart.split('-')
      const [hours, minutes] = (timePart || '00:00').split(':')
      // Format as ISO string (backend will interpret this in its timezone)
      // We're preserving the exact date/time values the user selected
      const isoDate = `${year}-${month}-${day}T${hours}:${minutes}:00`

      // Update the event via API
      await axios.patch(`${API_URL}/api/events/${eventId}/`, {
        organization: editValues.organization.trim(),
        name: editValues.name.trim(),
        date: isoDate
      })

      // Update local state
      setEvents(events.map(e => 
        e.id === eventId 
          ? { 
              ...e, 
              organization: editValues.organization.trim(),
              name: editValues.name.trim(),
              date: isoDate
            }
          : e
      ))

      setEditingEventId(null)
      setEditValues({
        organization: "",
        name: "",
        date: ""
      })
      
      toast({
        title: "Success",
        description: "Event updated successfully",
      })
    } catch (error) {
      console.error('Error updating event:', error)
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownloadCSV = (event) => {
    if (!event || !event.attendees || event.attendees.length === 0) {
      toast({
        title: "Error",
        description: "No attendees to download",
        variant: "destructive"
      })
      return
    }

    // Create CSV content
    const csvContent = [
      `${event.name},${format(new Date(event.date), 'M/d/yy')}`,
      'First Name,Last Name,A-Number',
      ...event.attendees
        .sort((a, b) => 
          `${a.student.last_name} ${a.student.first_name}`
            .localeCompare(`${b.student.last_name} ${b.student.first_name}`)
        )
        .map(record => {
          // Get A-number from username (which is typically the A-number)
          const aNumber = record.student.username || record.student.user?.username || 'N/A'
          return `${record.student.first_name},${record.student.last_name},${aNumber}`
        })
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
    URL.revokeObjectURL(url)
  }

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    setIsSaving(true)
    try {
      await axios.delete(`${API_URL}/api/events/${eventId}/`)

      // Remove event from local state
      setEvents(events.filter(e => e.id !== eventId))

      // If we were viewing attendees for this event, close the dialog
      if (selectedEvent?.id === eventId) {
        setShowAttendees(false)
        setSelectedEvent(null)
      }

      // Exit edit mode if we were editing this event
      if (editingEventId === eventId) {
        setEditingEventId(null)
        setEditValues({
          organization: "",
          name: "",
          date: ""
        })
      }

      toast({
        title: "Success",
        description: "Event deleted successfully",
      })
    } catch (error) {
      console.error('Error deleting event:', error)
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredEvents = events
    .filter(event => 
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.organization.toLowerCase().includes(searchTerm.toLowerCase())
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
            <TableHead>Event Type</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Date</TableHead>
            {showAttendance && <TableHead>Attendance</TableHead>}
            <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell className="font-medium">
              {editingEventId === event.id ? (
                <Input
                  value={editValues.organization}
                  onChange={(e) => setEditValues({ ...editValues, organization: e.target.value })}
                  className="w-32"
                  disabled={isSaving}
                />
              ) : (
                event.organization
              )}
            </TableCell>
            <TableCell>
              {editingEventId === event.id ? (
                <Input
                  value={editValues.name}
                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                  className="w-full"
                  disabled={isSaving}
                />
              ) : (
                event.name
              )}
            </TableCell>
            <TableCell>
              {editingEventId === event.id ? (
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={editValues.date.split('T')[0]}
                    onChange={(e) => {
                      const timePart = editValues.date.includes('T') ? editValues.date.split('T')[1] : '00:00'
                      setEditValues({ ...editValues, date: `${e.target.value}T${timePart}` })
                    }}
                    className="flex-1"
                    disabled={isSaving}
                  />
                  <Input
                    type="time"
                    value={editValues.date.includes('T') ? editValues.date.split('T')[1] : '00:00'}
                    onChange={(e) => {
                      const datePart = editValues.date.split('T')[0]
                      setEditValues({ ...editValues, date: `${datePart}T${e.target.value}` })
                    }}
                    className="flex-1"
                    disabled={isSaving}
                  />
                </div>
              ) : (
                <>
                  <span className="sm:hidden">
                    {format(new Date(event.date), 'MMM d, yyyy')}
                  </span>
                  <span className="hidden sm:inline">
                    {format(new Date(event.date), 'MMM d, yyyy h:mm a')}
                  </span>
                </>
              )}
            </TableCell>
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
            <TableCell>
              {editingEventId === event.id ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSaveEdit(event.id)}
                    disabled={isSaving}
                    className="h-8 w-8 p-0"
                    title="Save"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="h-8 w-8 p-0"
                    title="Cancel"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteEvent(event.id)}
                    disabled={isSaving}
                    className="h-8 w-8 p-0"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEditClick(event)}
                  className="h-8 w-8 p-0"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
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
          placeholder="Search by name or organization..."
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
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Checked In Students ({selectedEvent?.attendees?.length || 0})</h3>
                <Button
                  variant="outline"
                  onClick={() => handleDownloadCSV(selectedEvent)}
                  disabled={!selectedEvent?.attendees || selectedEvent.attendees.length === 0}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
              </div>
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