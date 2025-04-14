import { useAuth } from "@/hooks/useAuth"
import { useEffect, useState } from "react"
import axios from "axios"
import { API_URL } from '@/config/api'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function StudentDashboard() {
  const { user } = useAuth()
  const [totalPoints, setTotalPoints] = useState(0)

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const attendanceRes = await axios.get(`${API_URL}/api/attendance`)
        const userAttendance = attendanceRes.data.find(
          record => record.student.user === user.id
        )
        setTotalPoints(userAttendance?.student.total_points || 0)
      } catch (error) {
        console.error('Error fetching student data:', error)
      }
    }

    if (user?.id) {
      fetchStudentData()
    }
  }, [user])

  return (
    <div className="container mx-auto p-8 pt-24">
      <h1 className="text-3xl font-bold mb-6">
        Student Dashboard
      </h1>

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
    </div>
  )
}

export default StudentDashboard 