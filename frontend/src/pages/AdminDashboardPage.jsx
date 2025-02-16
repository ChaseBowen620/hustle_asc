import { useState, useEffect } from "react"
import axios from "axios"
import { Line } from 'react-chartjs-2'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { API_URL } from '@/config/api'
import '../lib/chart'  // Import the chart registration

function AdminDashboardPage() {
  const [students, setStudents] = useState([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [participatingStudents, setParticipatingStudents] = useState(0)
  const [filter, setFilter] = useState("semester")
  const [attendanceData, setAttendanceData] = useState([])

  useEffect(() => {
    fetchStudentData()
    fetchAttendanceData()
  }, [filter])

  const fetchStudentData = async () => {
    try {
      const [totalRes, participatingRes, studentsRes] = await Promise.all([
        axios.get(`${API_URL}/api/students/total`),
        axios.get(`${API_URL}/api/students/participating`),
        axios.get(`${API_URL}/api/students/points`, { params: { filter } })
      ])
      setTotalStudents(totalRes.data.count)
      setParticipatingStudents(participatingRes.data.count)
      setStudents(studentsRes.data)
    } catch (error) {
      console.error('Error fetching student data:', error)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/attendance/overview`)
      setAttendanceData(response.data)
    } catch (error) {
      console.error('Error fetching attendance data:', error)
    }
  }

  const chartData = {
    labels: attendanceData.map(data => data.date),
    datasets: attendanceData.map(eventTypeData => ({
      label: eventTypeData.event_type,
      data: eventTypeData.attendance_counts,
      fill: false,
      borderColor: 'randomColor()'
    }))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Students</CardTitle>
            <CardDescription>All registered students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalStudents}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Active Students</CardTitle>
            <CardDescription>Current semester participation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{participatingStudents}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Participation Rate</CardTitle>
            <CardDescription>Current semester</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {((participatingStudents / totalStudents) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="students" className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Student Overview</TabsTrigger>
          <TabsTrigger value="attendance">Attendance Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="space-y-4">
          <div className="flex justify-end space-x-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              All Time
            </Button>
            <Button
              variant={filter === "year" ? "default" : "outline"}
              onClick={() => setFilter("year")}
            >
              This Year
            </Button>
            <Button
              variant={filter === "semester" ? "default" : "outline"}
              onClick={() => setFilter("semester")}
            >
              This Semester
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(student => (
                  <TableRow key={student.id}>
                    <TableCell>{student.first_name} {student.last_name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell className="text-right">{student.total_points || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trends</CardTitle>
              <CardDescription>Event attendance over time by event type</CardDescription>
            </CardHeader>
            <CardContent>
              <Line data={chartData} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminDashboardPage 