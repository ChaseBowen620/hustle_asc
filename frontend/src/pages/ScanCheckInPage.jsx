import { useState, useEffect, useCallback } from "react"
import { useParams } from "react-router-dom"
import axios from "axios"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { API_URL } from "@/config/api"
import { isEventTodayMST, formatMSTDateString } from "@/utils/mstDate"
import CheckInStudents from "@/components/CheckInStudents"

function ScanCheckInPage() {
  const { organization } = useParams()
  const [events, setEvents] = useState([])
  const [students, setStudents] = useState([])
  const [attendances, setAttendances] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
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

  const todayEvents = events
    .filter((e) => isEventTodayMST(e.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date))

  const singleEvent = todayEvents.length === 1 ? todayEvents[0] : null
  const effectiveEvent = selectedEvent || singleEvent

  useEffect(() => {
    if (singleEvent && !selectedEvent) setSelectedEvent(singleEvent)
  }, [singleEvent?.id])

  const eventAttendances = (() => {
    const apiList = Array.isArray(attendances) ? attendances : []
    return effectiveEvent ? apiList.filter((a) => Number(a.event) === Number(effectiveEvent.id)) : []
  })()

  const handleCheckIn = useCallback(
    async (student) => {
      if (!effectiveEvent) return
      setCheckingIn(true)
      try {
        await axios.post(`${API_URL}/api/attendance/`, {
          student: student.id,
          event: effectiveEvent.id,
        })
        toast({
          title: "Checked in",
          description: `${student.first_name} ${student.last_name} has been checked in.`,
          className: "bg-green-50 border-green-200 text-black",
        })
        fetchAttendances()
      } catch (err) {
        const msg = err.response?.data?.error || err.message
        const alreadyCheckedIn = /already checked in|already exists/i.test(msg)
        toast({
          title: alreadyCheckedIn ? "Already checked in" : "Error",
          description: alreadyCheckedIn ? "This student is already checked in for this event." : msg,
          variant: "destructive",
        })
      } finally {
        setCheckingIn(false)
      }
    },
    [effectiveEvent, toast, fetchAttendances]
  )

  const handleNewUserAndCheckIn = useCallback(
    async (data) => {
      if (!effectiveEvent) return
      setCheckingIn(true)
      try {
        const regRes = await axios.post(`${API_URL}/api/register/`, {
          first_name: data.first_name,
          last_name: data.last_name,
          a_number: data.a_number,
        })
        const studentId = regRes.data.student_id
        if (studentId == null) {
          toast({ title: "Error", description: "Registration did not return a student ID.", variant: "destructive" })
          return
        }
        await axios.post(`${API_URL}/api/attendance/`, {
          student: studentId,
          event: effectiveEvent.id,
        })
        toast({
          title: "Checked in",
          description: `${data.first_name} ${data.last_name} has been added and checked in.`,
          className: "bg-green-50 border-green-200 text-black",
        })
        fetchStudents()
        fetchAttendances()
      } catch (err) {
        toast({ title: "Error", description: err.response?.data?.error || err.message, variant: "destructive" })
      } finally {
        setCheckingIn(false)
      }
    },
    [effectiveEvent, toast, fetchStudents, fetchAttendances]
  )

  const handleUserCreated = useCallback(() => {
    fetchStudents()
  }, [fetchStudents])

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
            attendances={eventAttendances}
            selectedEvent={effectiveEvent}
            onUserCreated={handleUserCreated}
            onNewUserAndCheckIn={handleNewUserAndCheckIn}
            scanMode
            checkingIn={checkingIn}
          />
        </div>
      )}
    </div>
  )
}

export default ScanCheckInPage
