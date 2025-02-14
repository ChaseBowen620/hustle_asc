import { useState, useEffect } from "react"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import CheckInStudents from "../components/CheckInStudents"
import { API_URL } from '../config/api'

function CheckInPage() {
  const [events, setEvents] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, studentsRes] = await Promise.all([
          axios.get(`${API_URL}/api/events/`),
          axios.get(`${API_URL}/api/students/`)
        ])
        setEvents(eventsRes.data)
        setStudents(studentsRes.data)
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleCheckIn = async (eventId, studentId) => {
    try {
      const response = await axios.post(`${API_URL}/api/attendance/`, {
        student: studentId,
        event: eventId
      })
      return response.data
    } catch (error) {
      throw error
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">Loading check in...</div>
      </div>
    </div>
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Check In</h1>
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
      </div>
    </div>
  )
}

export default CheckInPage 