import { useState, useEffect } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format } from "date-fns"

function StudentDashboard() {
  const [events, setEvents] = useState([])
  const [attendance, setAttendance] = useState([])
  const [totalPoints, setTotalPoints] = useState(0)
  const [loading, setLoading] = useState(true)
  const studentId = "1" // This should come from auth context later

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const [eventsRes, attendanceRes] = await Promise.all([
          axios.get('http://localhost:8000/api/events/'),
          axios.get(`http://localhost:8000/api/attendance/?student=${studentId}`)
        ])

        // Filter future events
        const futureEvents = eventsRes.data.filter(event => 
          new Date(event.date) > new Date()
        ).sort((a, b) => new Date(a.date) - new Date(b.date))

        setEvents(futureEvents)
        setAttendance(attendanceRes.data)

        // Calculate total points
        const points = attendanceRes.data.reduce((total, record) => {
          const event = eventsRes.data.find(e => e.id === record.event)
          return total + (event?.points || 0)
        }, 0)
        setTotalPoints(points)
      } catch (error) {
        console.error('Error fetching student data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStudentData()
  }, [studentId])

  if (loading) {
    return <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">Loading...</div>
      </div>
    </div>
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">My Dashboard</h1>

        {/* Points Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Total Points</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{totalPoints}</div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Upcoming Events</h2>
          <Card>
            <CardContent className="p-6">
              <div className="divide-y">
                {events.length > 0 ? (
                  events.map((event) => (
                    <div key={event.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{event.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(event.date), 'MMMM d, yyyy')} at {event.location}
                          </p>
                        </div>
                        <div className="text-sm font-medium">
                          {event.points} points
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No upcoming events
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Past Events */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">My Attendance</h2>
          <Card>
            <CardContent className="p-6">
              <div className="divide-y">
                {attendance.length > 0 ? (
                  attendance.map((record) => (
                    <div key={record.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{record.event.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(record.checked_in_at), 'MMMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <div className="text-sm font-medium">
                          {record.event.points} points
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No attendance records
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default StudentDashboard 