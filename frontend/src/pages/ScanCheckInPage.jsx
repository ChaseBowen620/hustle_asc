import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { API_URL } from "@/config/api"
import { isEventTodayMST, formatMSTDateString } from "@/utils/mstDate"
import {
  getQueue,
  addPendingAttendance,
  addPendingStudent,
  runFlushDue,
  removePendingAttendanceByTempId,
} from "@/utils/checkInQueue"
import CheckInStudents from "@/components/CheckInStudents"

function ScanCheckInPage() {
  const { organization } = useParams()
  const [events, setEvents] = useState([])
  const [students, setStudents] = useState([])
  const [attendances, setAttendances] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [queueVersion, setQueueVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchEvents = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events/?page_size=500`)
      const data = response.data
      let all = data.results ?? data ?? []
      if (organization) {
        const orgSlug = organization.toUpperCase().replace(/\s+/g, "")
        all = all.filter((event) => {
          const eventOrg = (event.organization || "").toUpperCase().replace(/\s+/g, "")
          if (eventOrg === orgSlug) return true
          if (event.event_organizations && Array.isArray(event.event_organizations)) {
            return event.event_organizations.some((eo) => {
              const name = (eo.organization_name || eo.organization || "").toUpperCase().replace(/\s+/g, "")
              return name === orgSlug
            })
          }
          return false
        })
      }
      setEvents(all)
    } catch (e) {
      console.error("Error fetching events:", e)
      toast({ title: "Error", description: "Could not load events", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [organization, toast])

  const fetchStudents = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/students/`)
      setStudents(Array.isArray(response.data) ? response.data : response.data?.results ?? [])
    } catch (e) {
      console.error("Error fetching students:", e)
    }
  }, [])

  const fetchAttendances = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/api/attendance/`)
      setAttendances(response.data)
    } catch (e) {
      console.error("Error fetching attendances:", e)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
    fetchStudents()
  }, [fetchEvents, fetchStudents])

  useEffect(() => {
    if (selectedEvent) fetchAttendances()
  }, [selectedEvent, fetchAttendances])

  useEffect(() => {
    const id = setInterval(() => {
      runFlushDue(API_URL, (eventId, err) => {
        console.error("Flush error for event", eventId, err)
        toast({ title: "Flush error", description: String(err?.message), variant: "destructive" })
      })
      setQueueVersion((v) => v + 1)
    }, 60000)
    return () => clearInterval(id)
  }, [toast])

  const todayEvents = events
    .filter((e) => isEventTodayMST(e.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const singleEvent = todayEvents.length === 1 ? todayEvents[0] : null
  const effectiveEvent = selectedEvent || singleEvent

  useEffect(() => {
    if (singleEvent && !selectedEvent) setSelectedEvent(singleEvent)
  }, [singleEvent?.id])

  const mergedAttendances = (() => {
    const apiList = Array.isArray(attendances) ? attendances : []
    const forEvent = effectiveEvent
      ? apiList.filter((a) => Number(a.event) === Number(effectiveEvent.id))
      : []
    const queue = getQueue()
    const pendingForEvent = (queue.attendances || []).filter(
      (a) => Number(a.eventId) === Number(effectiveEvent?.id)
    )
    const resolved = pendingForEvent.map((p) => {
      let student
      if (typeof p.studentId === "number") {
        student = students.find((s) => s.id === p.studentId)
      } else {
        const pendingStu = (queue.students || []).find((s) => s.tempId === p.studentId)
        if (pendingStu)
          student = {
            id: p.studentId,
            first_name: pendingStu.first_name,
            last_name: pendingStu.last_name,
            email: pendingStu.a_number ? `${pendingStu.a_number}@usu.edu` : "",
            username: pendingStu.a_number,
          }
      }
      return student ? { student, event: effectiveEvent?.id, tempId: p.tempId } : null
    })
    return [...forEvent, ...resolved.filter(Boolean)]
  })()

  const handleCheckIn = useCallback(
    (student) => {
      if (!effectiveEvent) return
      addPendingAttendance({
        studentId: student.id,
        eventId: effectiveEvent.id,
        eventDate: effectiveEvent.date,
      })
      toast({
        title: "Checked in",
        description: `${student.first_name} ${student.last_name} checked in (pending sync).`,
        className: "bg-green-50 border-green-200 text-black",
      })
      setQueueVersion((v) => v + 1)
    },
    [effectiveEvent, toast]
  )

  const handleNewUserAndCheckIn = useCallback(
    (data) => {
      if (!effectiveEvent) return
      const studentTempId = addPendingStudent({
        first_name: data.first_name,
        last_name: data.last_name,
        a_number: data.a_number,
      })
      addPendingAttendance({
        studentId: studentTempId,
        eventId: effectiveEvent.id,
        eventDate: effectiveEvent.date,
      })
      toast({
        title: "Checked in",
        description: `${data.first_name} ${data.last_name} added and checked in (pending sync).`,
        className: "bg-green-50 border-green-200 text-black",
      })
      setQueueVersion((v) => v + 1)
    },
    [effectiveEvent, toast]
  )

  const handleUserCreated = useCallback(() => {
    fetchStudents()
  }, [fetchStudents])

  const handleRemovePendingAttendance = useCallback((tempId) => {
    removePendingAttendanceByTempId(tempId)
    setQueueVersion((v) => v + 1)
    toast({ title: "Removed", description: "Student removed from check-in (pending sync)." })
  }, [toast])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 max-w-lg mx-auto">
      <header className="py-4 text-center border-b border-slate-200 mb-4">
        <h1 className="text-xl font-bold text-slate-900">HUSTLE Check In</h1>
      </header>

      {!effectiveEvent ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-800">Today&apos;s Events (MST)</h2>
          {todayEvents.length === 0 ? (
            <p className="text-slate-500 py-4">No events today.</p>
          ) : (
            <ul className="space-y-2">
              {todayEvents.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(event)}
                    className="w-full text-left p-4 rounded-lg bg-white border border-slate-200 shadow-sm hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <span className="font-medium text-slate-900 block">{event.name}</span>
                    <span className="text-sm text-slate-500">{formatMSTDateString(event.date)}</span>
                    {event.organization && (
                      <span className="text-sm text-slate-500 block mt-1">{event.organization}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-slate-600 font-medium">{effectiveEvent.name}</p>
          <p className="text-sm text-slate-500">{formatMSTDateString(effectiveEvent.date)}</p>
          <CheckInStudents
            students={students}
            onCheckIn={handleCheckIn}
            attendances={mergedAttendances}
            selectedEvent={effectiveEvent}
            onUserCreated={handleUserCreated}
            useQueue
            onNewUserAndCheckIn={handleNewUserAndCheckIn}
            onRemovePendingAttendance={handleRemovePendingAttendance}
            scanMode
          />
        </div>
      )}
    </div>
  )
}

export default ScanCheckInPage
