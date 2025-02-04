import { useState, useEffect } from "react"
import axios from "axios"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import CreateEvent from "../components/CreateEvent"
import CheckInStudents from "../components/CheckInStudents"
import Calendar from "../components/Calendar"

function EventsPage() {
  const [events, setEvents] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/students/')
        console.log('Students response:', response.data)
        setStudents(response.data)
      } catch (error) {
        console.error('Error fetching students:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStudents()
  }, [])

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/events/')
        console.log('Events response:', response.data)
        setEvents(response.data)
      } catch (error) {
        console.error('Error fetching events:', error)
      }
    }

    fetchEvents()
  }, [])

  const handleCreateEvent = async (newEvent) => {
    try {
      const response = await axios.post('http://localhost:8000/api/events/', {
        name: newEvent.name,
        description: newEvent.description || "",
        date: newEvent.date,
        location: newEvent.location,
        points: parseInt(newEvent.points)
      })
      setEvents([...events, response.data])
    } catch (error) {
      console.error('Error creating event:', error)
    }
  }

  const handleCheckIn = async (eventId, studentId) => {
    try {
      const response = await axios.post('http://localhost:8000/api/attendance/', {
        student: studentId,
        event: eventId
      })
      return response.data  // Return the response data for success case
    } catch (error) {
      // Throw the error to be handled by CheckInStudents component
      throw error
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Events</h1>
        
        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
            <TabsTrigger value="checkin">Check In</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-6">
            <div className="overflow-x-auto">
              <div className="min-w-[320px]">
                <Calendar events={events} onCreateEvent={handleCreateEvent} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="checkin">
            <Card>
              <CardHeader>
                <CardTitle>Check In Students</CardTitle>
              </CardHeader>
              <CardContent>
                <CheckInStudents 
                  events={events}
                  students={students}
                  onCheckIn={handleCheckIn}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default EventsPage 