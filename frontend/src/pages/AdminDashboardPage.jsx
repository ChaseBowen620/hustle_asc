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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Colors for organizations (bar chart and timeline)
const ORG_COLORS = [
  'rgba(54, 162, 235, 0.85)',
  'rgba(255, 99, 132, 0.85)',
  'rgba(255, 206, 86, 0.85)',
  'rgba(75, 192, 192, 0.85)',
  'rgba(153, 102, 255, 0.85)',
  'rgba(255, 159, 64, 0.85)',
]

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
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [activeTab, setActiveTab] = useState("students")
  const [studentAttendanceByOrg, setStudentAttendanceByOrg] = useState(null)
  const [studentTimelineData, setStudentTimelineData] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  // No authentication - show all data
  const canSeeAllData = true

  useEffect(() => {
    fetchStudentData()
    fetchAttendanceData()
    fetchOrganizations()
  }, [filter, selectedOrganization])

  // Refresh student metrics when filter or organization changes and a student is selected
  useEffect(() => {
    if (selectedStudent) {
      fetchStudentAttendanceByOrg(selectedStudent.id)
    }
  }, [filter, selectedOrganization])

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
        axios.get(`${API_URL}/api/events/?page_size=1000`),
        axios.get(totalStudentsUrl),
        axios.get(participatingStudentsUrl),
        axios.get(studentPointsUrl)
      ])
      
      // Create event date map (handle paginated response)
      const eventsList = eventData.data.results ?? eventData.data
      const eventDateMap = (Array.isArray(eventsList) ? eventsList : []).reduce((acc, event) => {
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


  // Helper: get all org names for an event (primary + secondaries)
  const getEventOrgNames = (event) => {
        const primary = event.organization || 'Unknown'
        const secondaries = (event.event_organizations || []).map(eo => eo.organization_name || eo.organization).filter(Boolean)
        return [...new Set([primary, ...secondaries])]
      }

  const fetchStudentAttendanceByOrg = async (studentId) => {
    try {
      const attendanceResponse = await axios.get(`${API_URL}/api/attendance`)
      const allAttendances = attendanceResponse.data
      const eventsResponse = await axios.get(`${API_URL}/api/events/?page_size=1000`)
      const allEvents = eventsResponse.data.results ?? eventsResponse.data ?? []

      // Filter events by organization (same as dashboard)
      let events = allEvents
      if (selectedOrganization) {
        events = allEvents.filter(event =>
          event.organization === selectedOrganization ||
          (event.event_organizations && event.event_organizations.some(eo =>
            (eo.organization_name || eo.organization) === selectedOrganization
          ))
        )
      }

      // Date range for filter
      const now = new Date()
      let startDate = null
      let endDate = null
      if (filter === "year") {
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        if (currentMonth >= 7) {
          startDate = new Date(currentYear, 7, 1)
          endDate = new Date(currentYear + 1, 7, 1)
        } else {
          startDate = new Date(currentYear - 1, 7, 1)
          endDate = new Date(currentYear, 7, 1)
        }
      } else if (filter === "semester") {
        const currentMonth = now.getMonth()
        if (currentMonth >= 0 && currentMonth <= 4) {
          startDate = new Date(now.getFullYear(), 0, 1)
          endDate = new Date(now.getFullYear(), 7, 1)
        } else {
          startDate = new Date(now.getFullYear(), 7, 1)
          endDate = new Date(now.getFullYear() + 1, 0, 1)
        }
      }

      if (filter !== "all" && startDate && endDate) {
        events = events.filter(event => {
          const d = new Date(event.date)
          return d >= startDate && d < endDate
        })
      }

      // eventId -> { dateStr, orgNames, primaryOrg }
      const eventMap = {}
      events.forEach(event => {
        const dateStr = event.date.split('T')[0]
        const primaryOrg = event.organization || 'Unknown'
        eventMap[event.id] = { dateStr, orgNames: getEventOrgNames(event), primaryOrg }
      })

      const filteredEventIds = new Set(events.map(e => e.id))

      // Student attendances in filtered set
      const attendances = allAttendances.filter(attendance => {
        const studentIdValue = typeof attendance.student === 'object'
          ? attendance.student?.id
          : attendance.student || attendance.student_id
        if (studentIdValue !== studentId) return false
        const eventId = typeof attendance.event === 'object'
          ? attendance.event?.id
          : attendance.event || attendance.event_id
        return filteredEventIds.has(eventId)
      })

      // Bar chart: when viewing one org (filter), count that org; when viewing all orgs, count each attendance once (primary org only)
      const orgCounts = {}
      attendances.forEach(attendance => {
        const eventId = typeof attendance.event === 'object'
          ? attendance.event?.id
          : attendance.event || attendance.event_id
        const info = eventMap[eventId]
        if (!info) return
        if (selectedOrganization) {
          // One org filter: count for that org only
          if (info.orgNames.includes(selectedOrganization)) orgCounts[selectedOrganization] = (orgCounts[selectedOrganization] || 0) + 1
        } else {
          // All orgs: one attendance per event, attribute to primary org only
          const primary = info.primaryOrg
          orgCounts[primary] = (orgCounts[primary] || 0) + 1
        }
      })
      setStudentAttendanceByOrg(orgCounts)

      // Timeline: per-org event dates only (each row has circles only for dates that org had an event)
      const orgEventDates = {}
      events.forEach(event => {
        const dateStr = event.date.split('T')[0]
        const orgsToAdd = selectedOrganization
          ? (getEventOrgNames(event).includes(selectedOrganization) ? [selectedOrganization] : [])
          : getEventOrgNames(event)
        orgsToAdd.forEach(org => {
          if (!orgEventDates[org]) orgEventDates[org] = []
          orgEventDates[org].push(dateStr)
        })
      })
      Object.keys(orgEventDates).forEach(org => {
        orgEventDates[org] = [...new Set(orgEventDates[org])].sort()
      })

      const orgAttendance = {}
      Object.keys(orgEventDates).forEach(org => { orgAttendance[org] = new Set() })
      attendances.forEach(attendance => {
        const eventId = typeof attendance.event === 'object'
          ? attendance.event?.id
          : attendance.event || attendance.event_id
        const info = eventMap[eventId]
        if (!info) return
        if (selectedOrganization) {
          if (info.orgNames.includes(selectedOrganization)) orgAttendance[selectedOrganization].add(info.dateStr)
        } else {
          // No filter: fill circle for every org tied to this event (primary + sub-orgs), so PyData etc. show attended
          info.orgNames.forEach(org => {
            if (orgAttendance[org]) orgAttendance[org].add(info.dateStr)
          })
        }
      })
      const orgAttendanceSerialized = {}
      Object.keys(orgAttendance).forEach(org => {
        orgAttendanceSerialized[org] = orgAttendance[org]
      })
      setStudentTimelineData({ orgDates: orgEventDates, orgAttendance: orgAttendanceSerialized })
    } catch (error) {
      console.error('Error fetching student attendance:', error)
      setStudentAttendanceByOrg({})
      setStudentTimelineData(null)
    }
  }

  const handleStudentClick = async (student) => {
    setSelectedStudent(student)
    setActiveTab("student-metrics")
    await fetchStudentAttendanceByOrg(student.id)
  }

  const fetchOrganizations = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events/organizations`)
      const list = Array.isArray(response.data) ? response.data : []
      setOrganizations(list.map(org => ({ id: org.id, name: org.name })))
    } catch (error) {
      console.error('Error fetching organizations:', error)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      const [attendanceResponse, eventsResponse] = await Promise.all([
        axios.get(`${API_URL}/api/attendance`),
        axios.get(`${API_URL}/api/events/?page_size=1000`)
      ])
      const eventsList = eventsResponse.data.results ?? eventsResponse.data
      const allEvents = Array.isArray(eventsList) ? eventsList : []
      // Filter events by organization if selected
      let filteredEvents = allEvents
      if (selectedOrganization) {
        filteredEvents = allEvents.filter(event => 
          event.organization === selectedOrganization ||
          (event.event_organizations && event.event_organizations.some(eo => 
            (eo.organization_name || eo.organization) === selectedOrganization
          ))
        )
      }

      // Filter events by date range (semester / year / all) to match the dashboard filter
      if (filter !== "all") {
        const now = new Date()
        let startDate = null
        let endDate = null

        if (filter === "year") {
          const currentMonth = now.getMonth()
          const currentYear = now.getFullYear()
          if (currentMonth >= 7) {
            startDate = new Date(currentYear, 7, 1)
            endDate = new Date(currentYear + 1, 7, 1)
          } else {
            startDate = new Date(currentYear - 1, 7, 1)
            endDate = new Date(currentYear, 7, 1)
          }
        } else if (filter === "semester") {
          const currentMonth = now.getMonth()
          if (currentMonth >= 0 && currentMonth <= 4) {
            startDate = new Date(now.getFullYear(), 0, 1)
            endDate = new Date(now.getFullYear(), 7, 1)
          } else {
            startDate = new Date(now.getFullYear(), 7, 1)
            endDate = new Date(now.getFullYear() + 1, 0, 1)
          }
        }

        if (startDate && endDate) {
          filteredEvents = filteredEvents.filter(event => {
            const eventDate = new Date(event.date)
            return eventDate >= startDate && eventDate < endDate
          })
        }
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
      
      // Group attendance by date, storing event IDs and names for each point
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
            eventIds: [], // Store event IDs for this date
            eventNames: [] // Store event names for this date
          }
        }
        
        acc[date].count++
        // Store event ID and name if not already stored (avoid duplicates)
        if (!acc[date].eventIds.includes(record.event)) {
          acc[date].eventIds.push(record.event)
          acc[date].eventNames.push(eventInfo.name)
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
      const eventNamesByDate = dates.reduce((acc, date) => {
        acc[date] = groupedData[date].eventNames || []
        return acc
      }, {})

      setAttendanceData({
        dates,
        attendance_counts,
        eventIdsByDate,
        eventNamesByDate
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
          eventNames: attendanceData.eventNamesByDate?.[date] || [], // Store event names with each point
          date: date // Store original date string for display
        }
      }).sort((a, b) => a.x - b.x),
      fill: false,
      borderColor: 'hsl(220, 70%, 50%)',
      tension: 0,
      spanGaps: true
    }]
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
            
            // Get event names from the point
            const eventNames = point.eventNames || []
            const eventNamesText = eventNames.length > 0 
              ? eventNames.join(', ') 
              : 'No events'
            
            return [
              `Date: ${formattedDate}`,
              `Event: ${eventNamesText}`,
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
        hoverRadius: 6
      }
    },
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="students">Attendance Ranking</TabsTrigger>
          <TabsTrigger value="attendance">Attendance Trends</TabsTrigger>
          <TabsTrigger value="student-metrics">Student Metrics</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex space-x-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All Time
            </Button>
            <Button
              variant={filter === "year" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("year")}
            >
              This Year
            </Button>
            <Button
              variant={filter === "semester" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("semester")}
            >
              This Semester
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Filter by Organization:</label>
            <Select
              value={selectedOrganization || "all"}
              onValueChange={(value) => {
                setSelectedOrganization(value === "all" ? "" : value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Organizations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id ?? org.name} value={org.name || org}>
                    {org.name || org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="students" className="space-y-4">
          <div className="flex justify-between items-center">
            <Input
              type="text"
              placeholder="Search students by name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              className="w-[250px]"
            />
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
              <CardDescription>
                Event attendance over time ({filter === "all" ? "All Time" : filter === "year" ? "This Year" : "This Semester"})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div style={{ height: '400px' }}>
                <Line data={chartData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="student-metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : 'Student Metrics'}
              </CardTitle>
              <CardDescription>
                {selectedStudent
                  ? `Attendance by organization (${filter === "all" ? "All Time" : filter === "year" ? "This Year" : "This Semester"})`
                  : 'Select a student from the Attendance Ranking tab to view their metrics here.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedStudent ? (
                <div className="space-y-6">
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
                                backgroundColor: Object.keys(studentAttendanceByOrg).map((_, i) => ORG_COLORS[i % ORG_COLORS.length].replace('0.85', '0.6')),
                                borderColor: Object.keys(studentAttendanceByOrg).map((_, i) => ORG_COLORS[i % ORG_COLORS.length].replace('0.85', '1')),
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

                      {studentTimelineData && Object.keys(studentTimelineData.orgDates || {}).length > 0 && (
                        <div className="mt-6">
                          <h4 className="font-semibold text-sm text-gray-600 mb-3">Attendance by date</h4>
                          <p className="text-xs text-gray-500 mb-2">
                            Each circle is an event date for that organization. Filled = attended; empty = did not attend.
                          </p>
                          <div className="space-y-3">
                            {Object.keys(studentTimelineData.orgDates).sort().map((orgName, orgIndex) => {
                              const dates = studentTimelineData.orgDates[orgName] || []
                              const attendedSet = studentTimelineData.orgAttendance[orgName]
                              const color = ORG_COLORS[orgIndex % ORG_COLORS.length]
                              return (
                                <div key={orgName} className="flex flex-wrap items-center gap-1">
                                  <span className="text-xs font-medium text-gray-600 w-32 shrink-0" title={orgName}>
                                    {orgName.length > 14 ? orgName.slice(0, 12) + '…' : orgName}
                                  </span>
                                  <div className="flex flex-wrap gap-0.5 items-center min-w-0">
                                    {dates.map((dateStr) => {
                                      const attended = attendedSet && attendedSet.has && attendedSet.has(dateStr)
                                      return (
                                        <span
                                          key={dateStr}
                                          className="inline-block rounded-full shrink-0 border border-gray-200"
                                          style={{
                                            width: 10,
                                            height: 10,
                                            backgroundColor: attended ? color : 'transparent',
                                          }}
                                          title={`${dateStr}${attended ? ' – attended' : ' – did not attend'}`}
                                        />
                                      )
                                    })}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No attendance data available for this student.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Click a student in the Attendance Ranking tab to view their metrics here.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AdminDashboardPage 