import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import axios from "axios"
import { API_URL } from '@/config/api'
import { format } from "date-fns"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

function StudentDashboard() {
  const { user } = useAuth()
  const [totalPoints, setTotalPoints] = useState(0)
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showEventDetails, setShowEventDetails] = useState(false)

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const authHeaders = {
          headers: {
            'Authorization': `Bearer ${user?.token}`
          }
        }
        
        const [attendanceRes, eventsRes] = await Promise.all([
          axios.get(`${API_URL}/api/attendance`, authHeaders),
          axios.get(`${API_URL}/api/events/upcoming/`, authHeaders)
        ])
        
        // Get total points from user data (already available from login)
        setTotalPoints(user?.student_profile?.total_points || 0)
        
        // Filter upcoming events (events in the future)
        const now = new Date()
        const upcoming = eventsRes.data.filter(event => new Date(event.date) > now)
        setUpcomingEvents(upcoming)
      } catch (error) {
        console.error('Error fetching student data:', error)
      }
    }

    if (user?.id) {
      fetchStudentData()
    }
  }, [user])

  const handleEventClick = (event) => {
    setSelectedEvent(event)
    setShowEventDetails(true)
  }

  return (
    <div className="container mx-auto p-8 pt-24">
      <h1 className="text-3xl font-bold mb-6">
        Student Dashboard
      </h1>

      <div className="grid gap-6">
        {/* Total Points Card */}
        <div className="grid place-items-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Total Points</CardTitle>
              <CardDescription>Your current point total</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-center">{totalPoints}</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Events you can attend to earn points</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Event Type</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingEvents.map((event) => (
                      <TableRow 
                        key={event.id}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => handleEventClick(event)}
                      >
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
                        <TableCell>{event.location}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No upcoming events at this time.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Event Details Modal */}
      <Dialog open={showEventDetails} onOpenChange={setShowEventDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.name}</DialogTitle>
            <DialogDescription>
              Event details and information
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-sm text-gray-600">Organization</h4>
                  <p className="text-sm">{selectedEvent.organization}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-600">Event Type</h4>
                  <p className="text-sm">{selectedEvent.event_type}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-600">Date & Time</h4>
                  <p className="text-sm">{format(new Date(selectedEvent.date), 'EEEE, MMMM d, yyyy h:mm a')}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-600">Location</h4>
                  <p className="text-sm">{selectedEvent.location}</p>
                </div>
              </div>
              {selectedEvent.description && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-600 mb-2">Description</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEvent.description}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default StudentDashboard 