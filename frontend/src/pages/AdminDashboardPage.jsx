import { useState, useEffect } from "react"
import axios from "axios"
import { useAuth } from "@/hooks/useAuth"
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
  const [uniqueEventTypes, setUniqueEventTypes] = useState([])
  const [selectedEventType, setSelectedEventType] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [selectedOrganization, setSelectedOrganization] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const studentsPerPage = 10
  const { user, isAdmin } = useAuth()
  const userIsAdmin = isAdmin(user)
  // Check if user can see all data (Super Admin, DAISSA, or Faculty)
  const canSeeAllData = userIsAdmin && user?.admin_profile?.role && 
    ['Super Admin', 'DAISSA', 'Faculty'].includes(user.admin_profile.role)

  useEffect(() => {
    fetchStudentData()
    fetchEventData()
    fetchAttendanceData()
    if (canSeeAllData) {
      fetchOrganizations()
    }
  }, [filter, selectedEventType, selectedOrganization, canSeeAllData])

  const fetchStudentData = async () => {
    try {
      const authHeaders = {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      }
      
      // Build student points URL with organization filter if applicable
      let studentPointsUrl = `${API_URL}/api/students/points/?filter=${filter}`
      if (canSeeAllData && selectedOrganization) {
        studentPointsUrl += `&organization=${encodeURIComponent(selectedOrganization)}`
      }
      
      const [studentData, attendanceData, eventData, totalStudentsRes, participatingStudentsRes, studentPointsRes] = await Promise.all([
        axios.get(`${API_URL}/api/students`, authHeaders),
        axios.get(`${API_URL}/api/attendance`, authHeaders),
        axios.get(`${API_URL}/api/events`, authHeaders),
        axios.get(`${API_URL}/api/students/total/`, authHeaders),
        axios.get(`${API_URL}/api/students/participating/?filter=${filter}`, authHeaders),
        axios.get(studentPointsUrl, authHeaders)
      ])
      
      // Create event date map
      const eventDateMap = eventData.data.reduce((acc, event) => {
        acc[event.id] = new Date(event.date)
        return acc
      }, {})
      
      // Calculate date range based on filter
      const now = new Date()
      let startDate = null
      
      if (filter === "year") {
        // Academic year: Fall semester starts in August
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        
        if (currentMonth >= 7) { // Aug-Dec (Fall semester)
          // Current academic year started in August of current year
          startDate = new Date(currentYear, 7, 1) // August 1st of current year
        } else { // Jan-July (Spring semester)
          // Current academic year started in August of previous year
          startDate = new Date(currentYear - 1, 7, 1) // August 1st of previous year
        }
      } else if (filter === "semester") {
        // Assuming fall semester starts in August, spring in January
        const currentMonth = now.getMonth()
        if (currentMonth >= 0 && currentMonth <= 4) { // Jan-May (Spring)
          startDate = new Date(now.getFullYear(), 0, 1)
        } else { // Aug-Dec (Fall)
          startDate = new Date(now.getFullYear(), 7, 1) // August 1st
        }
      }
      
      // Use backend API data for filtered points (already organization-filtered)
      const studentsWithFilteredPoints = studentData.data.map(student => {
        // Find the student's points from the backend API response
        const studentPointsData = studentPointsRes.data.find(sp => sp.student_id === student.id)
        const filteredPoints = studentPointsData ? studentPointsData.total_points : 0
        
        return {
          ...student,
          filtered_points: filteredPoints
        }
      })
      
      // Sort students by filtered points (descending) and then alphabetically
      const sortedStudents = studentsWithFilteredPoints.sort((a, b) => {
        // First compare by filtered points (descending)
        const pointsDiff = b.filtered_points - a.filtered_points
        
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
      
      // Use API responses for totals (already filtered by organization)
      setTotalStudents(totalStudentsRes.data.count)
      setParticipatingStudents(participatingStudentsRes.data.count)
      setStudents(sortedStudents)
    } catch (error) {
      console.error('Error fetching student data:', error)
    }
  }

  const fetchEventData = async () => {
    try {
      const authHeaders = {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      }
      
      const [eventsResponse, eventTypesResponse] = await Promise.all([
        axios.get(`${API_URL}/api/events`, authHeaders),
        axios.get(`${API_URL}/api/events/types`, authHeaders)
      ])
      
      // Create a map of event IDs to their types
      const eventTypeMap = eventsResponse.data.reduce((acc, event) => {
        acc[event.id] = {
          type_id: event.event_type,
          type_name: event.event_type,
          date: event.date.split('T')[0],
          name: event.name,
          organization: event.organization,
          event_type: event.event_type,
        }
        return acc
      }, {})
      setEventTypes(eventTypeMap)
      
      // Store unique event types from the new endpoint
      setUniqueEventTypes(eventTypesResponse.data)
    } catch (error) {
      console.error('Error fetching event data:', error)
    }
  }

  const fetchOrganizations = async () => {
    try {
      const authHeaders = {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      }
      
      const response = await axios.get(`${API_URL}/api/events/organizations/`, authHeaders)
      setOrganizations(response.data)
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      const authHeaders = {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      }
      
      const response = await axios.get(`${API_URL}/api/attendance`, authHeaders)
      
      // Group attendance by event type and date
      const groupedData = response.data.reduce((acc, record) => {
        const eventInfo = eventTypes[record.event]
        if (!eventInfo) return acc // Skip if no event info
        
        const date = eventInfo.date
        const typeId = eventInfo.type_id
        const typeName = eventInfo.type_name
        
        // Check if this event type is selected
        if (selectedEventType && selectedEventType.length > 0 && !selectedEventType.includes(typeName)) {
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
    labels: [...new Set(attendanceData.flatMap(data => data.dates))]
      .sort((a, b) => new Date(a) - new Date(b)),
    datasets: attendanceData.map((eventData, index) => {
      // Sort the data points by date
      const sortedData = eventData.dates
        .map((date, index) => ({
          x: new Date(date),
          y: eventData.attendance_counts[index]
        }))
        .sort((a, b) => a.x - b.x)
      
      return {
        label: eventData.event_type || 'Unknown Event Type',
        data: sortedData,
        fill: false,
        borderColor: EVENT_TYPE_COLORS[index] || `hsl(${index * 60}, 70%, 50%)`,
        tension: 0,
        spanGaps: true
      }
    })
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    aspectRatio: 2.5,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Attendance Count'
        }
      }
    },
    plugins: {
      legend: {
        display: true,
        position: 'top'
      }
    },
    elements: {
      line: {
        tension: 0
      }
    }
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
          <div className="flex justify-between items-center">
            {canSeeAllData && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium">Filter by Organization:</label>
                <Select
                  value={selectedOrganization || "all"}
                  onValueChange={(value) => {
                    setSelectedOrganization(value === "all" ? "" : value)
                    setCurrentPage(1) // Reset to first page when filter changes
                  }}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All Organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {organizations.map((org, index) => (
                      <SelectItem 
                        key={`org-${index}`} 
                        value={org}
                      >
                        {org}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex space-x-2">
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
                      <TableCell className="text-right">{student.filtered_points || 0}</TableCell>
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
                  value={selectedEventType.length > 0 ? selectedEventType[0] : ""}
                  onValueChange={(value) => setSelectedEventType([value])}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select an Event Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueEventTypes.map((type, index) => (
                      <SelectItem 
                        key={`event-type-${index}`} 
                        value={type}
                      >
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ height: '400px' }}>
                <Line key={`chart-${selectedEventType}`} data={chartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminDashboardPage 