import { useState, useEffect } from "react"
import axios from "axios"
import { Line, Bar } from 'react-chartjs-2'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { API_URL } from '@/config/api'
import '../lib/chart'  // Import the chart registration
import { format } from "date-fns"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"


function AdminDashboardPage() {
  const [students, setStudents] = useState([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [participatingStudents, setParticipatingStudents] = useState(0)
  const [filter, setFilter] = useState("semester")
  const [attendanceData, setAttendanceData] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [selectedOrganization, setSelectedOrganization] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const studentsPerPage = 10
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showEventDetails, setShowEventDetails] = useState(false)
  const [allEvents, setAllEvents] = useState([]) // Store all events for lookup
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showStudentDetails, setShowStudentDetails] = useState(false)
  const [studentAttendanceByOrg, setStudentAttendanceByOrg] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  // No authentication - show all data
  const canSeeAllData = true

  useEffect(() => {
    fetchStudentData()
    fetchEventData()
    fetchAttendanceData()
    fetchOrganizations()
  }, [filter, selectedOrganization])

  // Refresh student attendance chart when filter changes and dialog is open
  useEffect(() => {
    if (showStudentDetails && selectedStudent) {
      fetchStudentAttendanceByOrg(selectedStudent.id)
    }
  }, [filter])

  const fetchStudentData = async () => {
    try {
      // Build student points URL with organization filter if applicable
      let studentPointsUrl = `${API_URL}/api/students/points/?filter=${filter}`
      if (selectedOrganization) {
        studentPointsUrl += `&organization=${encodeURIComponent(selectedOrganization)}`
      }
      
      // Build URLs with organization filter if applicable
      let totalStudentsUrl = `${API_URL}/api/students/total/`
      let participatingStudentsUrl = `${API_URL}/api/students/participating/?filter=${filter}`
      if (selectedOrganization) {
        totalStudentsUrl += `?organization=${encodeURIComponent(selectedOrganization)}`
        participatingStudentsUrl += `&organization=${encodeURIComponent(selectedOrganization)}`
      }
      
      const [studentData, attendanceData, eventData, totalStudentsRes, participatingStudentsRes, studentPointsRes] = await Promise.all([
        axios.get(`${API_URL}/api/students`),
        axios.get(`${API_URL}/api/attendance`),
        axios.get(`${API_URL}/api/events`),
        axios.get(totalStudentsUrl),
        axios.get(participatingStudentsUrl),
        axios.get(studentPointsUrl)
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
      const eventsResponse = await axios.get(`${API_URL}/api/events`)
      
      // Store all events for lookup when clicking chart points
      setAllEvents(eventsResponse.data)
    } catch (error) {
      console.error('Error fetching event data:', error)
    }
  }

  const fetchStudentAttendanceByOrg = async (studentId) => {
    try {
      // Fetch all attendances and filter by student on frontend
      // (The API might not support student filtering directly)
      const attendanceResponse = await axios.get(`${API_URL}/api/attendance`)
      const allAttendances = attendanceResponse.data
      
      // Fetch all events to get organization info and dates
      const eventsResponse = await axios.get(`${API_URL}/api/events`)
      const events = eventsResponse.data
      
      // Create a map of event ID to organization and date
      const eventMap = {}
      events.forEach(event => {
        eventMap[event.id] = {
          organization: event.organization || 'Unknown',
          date: new Date(event.date)
        }
      })
      
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
      
      // Filter attendances for this specific student and by date
      const attendances = allAttendances.filter(attendance => {
        // Filter by student
        const studentIdValue = typeof attendance.student === 'object' 
          ? attendance.student?.id 
          : attendance.student || attendance.student_id
        if (studentIdValue !== studentId) return false
        
        // Filter by date if filter is not "all"
        if (filter !== "all" && startDate) {
          const eventId = typeof attendance.event === 'object' 
            ? attendance.event?.id 
            : attendance.event || attendance.event_id
          const eventInfo = eventMap[eventId]
          if (!eventInfo) return false
          
          const eventDate = eventInfo.date
          if (filter === "semester") {
            // For semester, also need end date
            const currentMonth = now.getMonth()
            let endDate
            if (currentMonth >= 0 && currentMonth <= 4) { // Jan-May (Spring)
              endDate = new Date(now.getFullYear(), 7, 1) // August 1st
            } else { // Aug-Dec (Fall)
              endDate = new Date(now.getFullYear() + 1, 0, 1) // January 1st of next year
            }
            return eventDate >= startDate && eventDate < endDate
          } else if (filter === "year") {
            // For year, include all events from startDate onwards
            return eventDate >= startDate
          }
        }
        
        return true
      })
      
      // Group attendances by organization
      const orgCounts = {}
      attendances.forEach(attendance => {
        // The event field can be an ID (number) or an object with an id property
        const eventId = typeof attendance.event === 'object' 
          ? attendance.event?.id 
          : attendance.event || attendance.event_id
        const eventInfo = eventMap[eventId]
        const org = eventInfo ? eventInfo.organization : 'Unknown'
        orgCounts[org] = (orgCounts[org] || 0) + 1
      })
      
      setStudentAttendanceByOrg(orgCounts)
    } catch (error) {
      console.error('Error fetching student attendance:', error)
      setStudentAttendanceByOrg({})
    }
  }

  const handleStudentClick = async (student) => {
    setSelectedStudent(student)
    setShowStudentDetails(true)
    await fetchStudentAttendanceByOrg(student.id)
  }

  const fetchOrganizations = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events`)
      // Get unique organizations from the organization column of events
      const uniqueOrgs = [...new Set(response.data.map(event => event.organization).filter(org => org))]
      // Sort alphabetically
      uniqueOrgs.sort()
      // Convert to array of objects with name property for consistency
      setOrganizations(uniqueOrgs.map(org => ({ name: org })))
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      const [attendanceResponse, eventsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/attendance`),
        axios.get(`${API_URL}/api/events`)
      ])
      
      // Filter events by organization if selected
      let filteredEvents = eventsResponse.data
      if (selectedOrganization) {
        filteredEvents = eventsResponse.data.filter(event => 
          event.organization === selectedOrganization ||
          (event.event_organizations && event.event_organizations.some(eo => 
            (eo.organization_name || eo.organization) === selectedOrganization
          ))
        )
      }
      
      // Create a map of event IDs to dates (only for filtered events)
      const eventDateMap = filteredEvents.reduce((acc, event) => {
        acc[event.id] = {
          date: event.date.split('T')[0],
          name: event.name,
          organization: event.organization,
          fullEvent: event
        }
        return acc
      }, {})
      
      // Get list of filtered event IDs
      const filteredEventIds = new Set(filteredEvents.map(e => e.id))
      
      // Group attendance by date, storing event IDs for each point
      // Only include attendance records for filtered events
      const groupedData = attendanceResponse.data.reduce((acc, record) => {
        // Skip if event is not in the filtered list
        if (!filteredEventIds.has(record.event)) return acc
        
        const eventInfo = eventDateMap[record.event]
        if (!eventInfo) return acc // Skip if no event info
        
        const date = eventInfo.date
        
        if (!acc[date]) {
          acc[date] = {
            count: 0,
            eventIds: [] // Store event IDs for this date
          }
        }
        
        acc[date].count++
        // Store event ID if not already stored (avoid duplicates)
        if (!acc[date].eventIds.includes(record.event)) {
          acc[date].eventIds.push(record.event)
        }
        return acc
      }, {})

      // Transform into the format needed for the chart
      const dates = Object.keys(groupedData).sort((a, b) => new Date(a) - new Date(b))
      const attendance_counts = dates.map(date => groupedData[date].count)
      const eventIdsByDate = dates.reduce((acc, date) => {
        acc[date] = groupedData[date].eventIds || []
        return acc
      }, {})

      setAttendanceData({
        dates,
        attendance_counts,
        eventIdsByDate
      })
    } catch (error) {
      console.error('Error fetching attendance data:', error)
    }
  }

  const chartData = {
    labels: attendanceData.dates || [],
    datasets: [{
      label: 'Attendance',
      data: (attendanceData.dates || []).map((date, index) => {
        // Get event IDs for this date
        const eventIds = attendanceData.eventIdsByDate?.[date] || []
        // Parse date properly - handle ISO format or date string
        let dateObj
        try {
          // Try parsing as ISO string first
          dateObj = new Date(date)
          // If invalid, try adding time if it's just a date
          if (isNaN(dateObj.getTime()) && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateObj = new Date(date + 'T00:00:00')
          }
          // If still invalid, use current date as fallback
          if (isNaN(dateObj.getTime())) {
            console.warn('Invalid date:', date)
            dateObj = new Date()
          }
        } catch (e) {
          console.warn('Error parsing date:', date, e)
          dateObj = new Date()
        }
        
        return {
          x: dateObj,
          y: attendanceData.attendance_counts?.[index] || 0,
          eventIds: eventIds, // Store event IDs with each point
          date: date // Store original date string for display
        }
      }).sort((a, b) => a.x - b.x),
      fill: false,
      borderColor: 'hsl(220, 70%, 50%)',
      tension: 0,
      spanGaps: true
    }]
  }

  const handleChartClick = (event, elements) => {
    if (elements.length === 0) return
    
    const element = elements[0]
    const index = element.index
    const point = chartData.datasets[0].data[index]
    
    // Get the first event ID from the clicked point
    if (point.eventIds && point.eventIds.length > 0) {
      const eventId = point.eventIds[0]
      const clickedEvent = allEvents.find(e => e.id === eventId)
      
      if (clickedEvent) {
        setSelectedEvent(clickedEvent)
        setShowEventDetails(true)
      }
    }
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
      },
      tooltip: {
        callbacks: {
          title: () => '', // Remove default title
          label: (context) => {
            const point = context.raw
            // Get the date from the point's date field (already in correct format)
            const dateStr = point.date || ''
            // Format date to mm/dd/yyyy
            let formattedDate = dateStr
            if (dateStr) {
              try {
                const date = new Date(dateStr)
                if (!isNaN(date.getTime())) {
                  formattedDate = format(date, 'MM/dd/yyyy')
                }
              } catch (e) {
                // If parsing fails, try to format the string directly
                formattedDate = dateStr
              }
            }
            return [
              `Date: ${formattedDate}`,
              `Attendees: ${context.parsed.y}`
            ]
          }
        }
      }
    },
    elements: {
      line: {
        tension: 0
      },
      point: {
        radius: 4,
        hoverRadius: 6,
        cursor: 'pointer'
      }
    },
    onClick: handleChartClick,
    onHover: (event, activeElements) => {
      event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default'
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
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Filter by Event Type:</label>
              <Select
                value={selectedOrganization || "all"}
                onValueChange={(value) => {
                  setSelectedOrganization(value === "all" ? "" : value)
                  setCurrentPage(1) // Reset to first page when filter changes
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Event Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Event Types</SelectItem>
                  {organizations.map((org, index) => (
                    <SelectItem 
                      key={`org-${index}`} 
                      value={org.name || org}
                    >
                      {org.name || org}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="text"
                placeholder="Search students by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1) // Reset to first page when search changes
                }}
                className="w-[250px]"
              />
            </div>
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
                  <TableHead className="text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students
                  .filter(student => {
                    if (!searchQuery) return true
                    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase()
                    const query = searchQuery.toLowerCase()
                    return fullName.includes(query)
                  })
                  .slice((currentPage - 1) * studentsPerPage, currentPage * studentsPerPage)
                  .map(student => (
                    <TableRow 
                      key={student.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleStudentClick(student)}
                    >
                      <TableCell>{student.first_name} {student.last_name}</TableCell>
                      <TableCell className="text-right">{student.filtered_points || 0}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          
          <Pagination
            totalStudents={students.filter(student => {
              if (!searchQuery) return true
              const fullName = `${student.first_name} ${student.last_name}`.toLowerCase()
              const query = searchQuery.toLowerCase()
              return fullName.includes(query)
            }).length}
            studentsPerPage={studentsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trends</CardTitle>
              <CardDescription>Event attendance over time</CardDescription>
              <div className="flex justify-end mt-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-medium">Filter by Organization:</label>
                  <Select
                    value={selectedOrganization || "all"}
                    onValueChange={(value) => {
                      setSelectedOrganization(value === "all" ? "" : value)
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
                          value={org.name || org}
                        >
                          {org.name || org}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ height: '400px' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Event Details Dialog */}
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
              {selectedEvent.event_organizations && selectedEvent.event_organizations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-gray-600 mb-2">Additional Organizations</h4>
                  <p className="text-sm text-gray-700">
                    {selectedEvent.event_organizations.map(eo => eo.organization_name || eo.organization).join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Student Details Dialog */}
      <Dialog open={showStudentDetails} onOpenChange={setShowStudentDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedStudent && `${selectedStudent.first_name} ${selectedStudent.last_name}`}
            </DialogTitle>
            <DialogDescription>
              Student attendance by organization ({filter === "all" ? "All Time" : filter === "year" ? "This Year" : "This Semester"})
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm text-gray-600 mb-1">A-Number</h4>
                <p className="text-sm text-gray-700">
                  {selectedStudent.user?.username || selectedStudent.user?.a_number || selectedStudent.a_number || 'N/A'}
                </p>
              </div>
              
              {studentAttendanceByOrg && Object.keys(studentAttendanceByOrg).length > 0 ? (
                <div>
                  <h4 className="font-semibold text-sm text-gray-600 mb-4">Attendance by Organization</h4>
                  <div style={{ height: '300px' }}>
                    <Bar
                      data={{
                        labels: Object.keys(studentAttendanceByOrg),
                        datasets: [
                          {
                            label: 'Number of Attendances',
                            data: Object.values(studentAttendanceByOrg),
                            backgroundColor: [
                              'rgba(54, 162, 235, 0.6)',
                              'rgba(255, 99, 132, 0.6)',
                              'rgba(255, 206, 86, 0.6)',
                              'rgba(75, 192, 192, 0.6)',
                              'rgba(153, 102, 255, 0.6)',
                              'rgba(255, 159, 64, 0.6)',
                            ],
                            borderColor: [
                              'rgba(54, 162, 235, 1)',
                              'rgba(255, 99, 132, 1)',
                              'rgba(255, 206, 86, 1)',
                              'rgba(75, 192, 192, 1)',
                              'rgba(153, 102, 255, 1)',
                              'rgba(255, 159, 64, 1)',
                            ],
                            borderWidth: 1,
                          },
                        ],
                      }}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                          y: {
                            beginAtZero: true,
                            ticks: {
                              stepSize: 1,
                            },
                          },
                        },
                        plugins: {
                          legend: {
                            display: false,
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">No attendance data available for this student.</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default AdminDashboardPage 