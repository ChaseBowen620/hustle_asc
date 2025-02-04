import { useState, useEffect } from "react"
import axios from "axios"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function AttendancePage() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showAttendees, setShowAttendees] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [attendanceRes, eventsRes] = await Promise.all([
          axios.get('http://localhost:8000/api/attendance/'),
          axios.get('http://localhost:8000/api/events/')
        ])

        // Group attendance by event
        const groupedAttendance = eventsRes.data.map(event => ({
          ...event,
          attendees: attendanceRes.data
            .filter(record => record.event === event.id)
            .map(record => ({
              ...record,
              student: record.student,
              checked_in_at: new Date(record.checked_in_at)
            }))
        }))

        // Sort by date (most recent first)
        const sortedEvents = groupedAttendance.sort((a, b) => 
          new Date(b.date) - new Date(a.date)
        )

        setEvents(sortedEvents)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleShowAttendees = (event) => {
    setSelectedEvent(event)
    setShowAttendees(true)
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
      .replace(/[/\\?%*:|"<>]/g, '-') // Replace invalid filename characters

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

  if (loading) {
    return <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">Loading attendance records...</div>
      </div>
    </div>
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Attendance</h1>
        
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="divide-y">
              {events.map((event) => (
                <div 
                  key={event.id}
                  className="py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-lg">{event.name}</h3>
                      <p className="text-sm text-neutral-500">
                        {format(new Date(event.date), 'MMMM d')}
                      </p>
                      <p className="text-sm text-neutral-500">{event.location}</p>
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-sm font-medium">
                        Attendance: {event.attendees.length}
                      </p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleShowAttendees(event)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

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

export default AttendancePage 