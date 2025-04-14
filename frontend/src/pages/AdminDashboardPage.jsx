import { useState, useEffect } from "react"
import axios from "axios"
import { Line } from 'react-chartjs-2'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { API_URL } from '@/config/api'
import '../lib/chart'  // Import the chart registration
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Add this constant at the top of the file, outside the component
const EVENT_TYPE_COLORS = {
  1: 'hsl(220, 70%, 50%)',  // Innovation Studio - blue
  2: 'hsl(150, 70%, 50%)',  // Workshop - green
  3: 'hsl(280, 70%, 50%)',  // Five-Slide Friday - purple
  4: 'hsl(340, 70%, 50%)',  // Competition - red
  5: 'hsl(40, 70%, 50%)',   // Other - orange
}

function AdminDashboardPage() {
  const [students, setStudents] = useState([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [participatingStudents, setParticipatingStudents] = useState(0)
  const [filter, setFilter] = useState("semester")
  const [attendanceData, setAttendanceData] = useState([])
  const [eventTypes, setEventTypes] = useState({})
  const [selectedEventType, setSelectedEventType] = useState()
  const [currentPage, setCurrentPage] = useState(1)
  const studentsPerPage = 10

  useEffect(() => {
    fetchStudentData()
    fetchEventData()
    fetchAttendanceData()
  }, [filter, selectedEventType])

  const fetchStudentData = async () => {
    try {
      const studentData = await axios.get(`${API_URL}/api/students`)
      
      // Sort students by points (descending) and then alphabetically
      const sortedStudents = studentData.data.sort((a, b) => {
        // First compare by points (descending)
        const pointsDiff = (b.total_points || 0) - (a.total_points || 0)
        
        // If points are equal, sort alphabetically by last name, then first name
        if (pointsDiff === 0) {
          const lastNameCompare = a.last_name.localeCompare(b.last_name)
          if (lastNameCompare === 0) {
            return a.first_name.localeCompare(b.first_name)
          }
          return lastNameCompare
        }
        
        return pointsDiff
      })
      
      setTotalStudents(sortedStudents.length)
      setStudents(sortedStudents)
      
      // Calculate participating students (students with points > 0)
      const participating = sortedStudents.filter(student => (student.total_points || 0) > 0)
      setParticipatingStudents(participating.length)
    } catch (error) {
      console.error('Error fetching student data:', error)
    }
  }

  const fetchEventData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events`)
      // Create a map of event IDs to their types
      const eventTypeMap = response.data.reduce((acc, event) => {
        acc[event.id] = {
          type_id: event.event_type,
          type_name: event.event_type_name,
          date: event.date.split('T')[0],
          name: event.name
        }
        return acc
      }, {})
      setEventTypes(eventTypeMap)
    } catch (error) {
      console.error('Error fetching event data:', error)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/attendance`)
      
      // Group attendance by event type and date
      const groupedData = response.data.reduce((acc, record) => {
        const eventInfo = eventTypes[record.event]
        if (!eventInfo) return acc // Skip if no event info
        
        const date = record.checked_in_at.split('T')[0]
        const typeId = eventInfo.type_id
        const typeName = eventInfo.type_name
        
        // Check if this event type is selected
        if (!selectedEventType.includes(typeId.toString())) {
          return acc
        }
        
        if (!acc[typeId]) {
          acc[typeId] = {
            event_type: typeName,
            dates: {},
          }
        }
        
        if (!acc[typeId].dates[date]) {
          acc[typeId].dates[date] = 0
        }
        
        acc[typeId].dates[date]++
        return acc
      }, {})

      // Transform into the format needed for the chart
      const transformedData = Object.values(groupedData).map(typeData => ({
        event_type: typeData.event_type,
        dates: Object.keys(typeData.dates),
        attendance_counts: Object.values(typeData.dates)
      }))

      setAttendanceData(transformedData)
    } catch (error) {
      console.error('Error fetching attendance data:', error)
    }
  }

  const chartData = {
    labels: [...new Set(attendanceData.flatMap(data => data.dates))].sort(),
    datasets: attendanceData.map(eventData => {
      const eventTypeId = Object.keys(eventTypes).find(
        key => eventTypes[key].type_name === eventData.event_type
      )
      return {
        label: eventData.event_type,
        data: eventData.dates.map((date, index) => ({
          x: date,
          y: eventData.attendance_counts[index]
        })),
        fill: false,
        borderColor: EVENT_TYPE_COLORS[eventTypeId] || 'hsl(0, 0%, 50%)'
      }
    })
  }

  // Get unique event types for the filter - moved outside of render
  const getUniqueEventTypes = (eventTypes) => {
    const uniqueTypes = new Map()
    Object.values(eventTypes).forEach(event => {
      uniqueTypes.set(event.type_id, {
        id: event.type_id,
        name: event.type_name
      })
    })
    return Array.from(uniqueTypes.values())
  }

  // Add pagination controls component
  const Pagination = ({ totalStudents, studentsPerPage, currentPage, onPageChange }) => {
    const totalPages = Math.ceil(totalStudents / studentsPerPage)
    
    return (
      <div className="flex justify-center space-x-2 mt-4">
        <Button
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Previous
        </Button>
        <div className="flex items-center">
          Page {currentPage} of {totalPages}
        </div>
        <Button
          variant="outline"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
        </Button>
      </div>
    )
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
                {students
                  .slice((currentPage - 1) * studentsPerPage, currentPage * studentsPerPage)
                  .map(student => (
                    <TableRow key={student.id}>
                      <TableCell>{student.first_name} {student.last_name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell className="text-right">{student.total_points || 0}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          
          <Pagination
            totalStudents={students.length}
            studentsPerPage={studentsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trends</CardTitle>
              <CardDescription>Event attendance over time by event type</CardDescription>
              <div className="flex justify-end space-x-2 mt-4">
                <Select
                  value={selectedEventType}
                  onValueChange={setSelectedEventType}
                  multiple
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select an Event" />
                  </SelectTrigger>
                  <SelectContent>
                    {getUniqueEventTypes(eventTypes).map(type => (
                      <SelectItem 
                        key={`event-type-${type.id}`} 
                        value={type.id.toString()}
                      >
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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