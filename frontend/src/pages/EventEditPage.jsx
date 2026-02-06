import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import axios from "axios"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronLeft, Loader2, UserMinus, Search } from "lucide-react"
import { API_URL } from "@/config/api"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"

const ADD_STUDENT_SEARCH_MIN = 1
const ADD_STUDENT_DROPDOWN_MAX = 10

function EventEditPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const authHeaders = user?.token ? { headers: { Authorization: `Bearer ${user.token}` } } : {}

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attendeesList, setAttendeesList] = useState([])
  const [attendeesLoading, setAttendeesLoading] = useState(false)
  const [students, setStudents] = useState([])
  const [addingStudent, setAddingStudent] = useState(false)
  const [removingAttendanceId, setRemovingAttendanceId] = useState(null)
  const [addStudentSearch, setAddStudentSearch] = useState("")
  const [addStudentSearchFocused, setAddStudentSearchFocused] = useState(false)

  const fetchEvent = useCallback(async () => {
    if (!eventId) return
    setLoading(true)
    try {
      const res = await axios.get(`${API_URL}/api/events/${eventId}/`)
      setEvent(res.data)
    } catch (err) {
      console.error("Error fetching event:", err)
      toast({ title: "Error", description: "Failed to load event.", variant: "destructive" })
      navigate("/events")
    } finally {
      setLoading(false)
    }
  }, [eventId, navigate, toast])

  const fetchAttendees = useCallback(async () => {
    if (!eventId) return
    setAttendeesLoading(true)
    try {
      const res = await axios.get(`${API_URL}/api/attendance/?event=${eventId}`)
      const data = Array.isArray(res.data) ? res.data : res.data?.results ?? []
      setAttendeesList(data)
    } catch (err) {
      console.error("Error fetching attendees:", err)
      toast({ title: "Error", description: "Failed to load attendees", variant: "destructive" })
    } finally {
      setAttendeesLoading(false)
    }
  }, [eventId, toast])

  const fetchStudents = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/students/`)
      setStudents(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch (err) {
      console.error("Error fetching students:", err)
    }
  }, [])

  useEffect(() => {
    fetchEvent()
  }, [fetchEvent])

  useEffect(() => {
    if (event) fetchAttendees()
  }, [event?.id, fetchAttendees])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  const attendedStudentIds = new Set((attendeesList || []).map((att) => att.student?.id).filter(Boolean))
  const studentsAvailableToAdd = students.filter((s) => !attendedStudentIds.has(s.id))

  const getStudentDisplayName = (s) =>
    `${s.first_name || ""} ${s.last_name || ""} ${(s.user?.username || s.username || "").toUpperCase()}`.trim()

  const addStudentSearchLower = (addStudentSearch || "").trim().toLowerCase()
  const addStudentSearchLongEnough = addStudentSearchLower.length >= ADD_STUDENT_SEARCH_MIN
  const addStudentMatches = addStudentSearchLongEnough
    ? studentsAvailableToAdd.filter((s) =>
        getStudentDisplayName(s).toLowerCase().includes(addStudentSearchLower)
      )
    : []
  const addStudentDropdownList = addStudentMatches.slice(0, ADD_STUDENT_DROPDOWN_MAX)
  const showAddStudentDropdown = addStudentSearchFocused && addStudentSearchLongEnough

  const handleAddStudent = async (studentId) => {
    if (!event?.id || !studentId) return
    setAddingStudent(true)
    try {
      await axios.post(
        `${API_URL}/api/attendance/`,
        { student: Number(studentId), event: event.id },
        authHeaders
      )
      toast({ title: "Added", description: "Student added to check-in." })
      setAddStudentSearch("")
      setAddStudentSearchFocused(false)
      await fetchAttendees()
    } catch (err) {
      const msg = err.response?.data?.error || "Failed to add student"
      toast({ title: "Error", description: msg, variant: "destructive" })
    } finally {
      setAddingStudent(false)
    }
  }

  const handleRemoveAttendance = async (attendanceId) => {
    if (!attendanceId) return
    setRemovingAttendanceId(attendanceId)
    try {
      await axios.delete(`${API_URL}/api/attendance/${attendanceId}/`, authHeaders)
      toast({ title: "Removed", description: "Student removed from check-in." })
      await fetchAttendees()
    } catch (err) {
      toast({ title: "Error", description: err.response?.data?.error || "Failed to remove", variant: "destructive" })
    } finally {
      setRemovingAttendanceId(null)
    }
  }

  if (loading || !event) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/events")}>
          <ChevronLeft className="h-4 w-4" />
          Back to Events
        </Button>
      </div>

      <div className="border rounded-lg p-4 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold">Who checked in ({attendeesList.length})</h2>
          <div className="relative flex items-center gap-2 min-w-0 max-w-sm flex-1">
            <Search className="h-4 w-4 text-slate-500 shrink-0" />
            <Input
              placeholder="Search by name or A-number to add…"
              value={addStudentSearch}
              onChange={(e) => setAddStudentSearch(e.target.value)}
              onFocus={() => setAddStudentSearchFocused(true)}
              onBlur={() => setTimeout(() => setAddStudentSearchFocused(false), 150)}
              disabled={addingStudent}
              className="flex-1 min-w-0"
            />
            {addingStudent && <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />}
            {showAddStudentDropdown && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 border rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto">
                {addStudentDropdownList.length === 0 ? (
                  <div className="px-3 py-4 text-center text-slate-500 text-sm">
                    No matching students. Try a different search.
                  </div>
                ) : (
                  addStudentDropdownList.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-slate-100 active:bg-slate-200 flex justify-between items-center border-b border-slate-100 last:border-0"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        handleAddStudent(s.id)
                      }}
                    >
                      <span className="font-medium truncate">{s.first_name} {s.last_name}</span>
                      <span className="text-slate-500 text-sm shrink-0 ml-2">
                        {(s.user?.username || s.username || "").toUpperCase() || "—"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
        {attendeesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : attendeesList.length === 0 ? (
          <p className="text-slate-500 text-sm py-4">No attendees for this event yet. Add a student above.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>A-Number</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendeesList.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium">
                      {att.student?.first_name} {att.student?.last_name}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {(att.student?.user?.username || att.student?.username || "").toUpperCase() || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleRemoveAttendance(att.id)}
                        disabled={removingAttendanceId === att.id}
                        title="Remove from check-in"
                      >
                        {removingAttendanceId === att.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

export default EventEditPage
