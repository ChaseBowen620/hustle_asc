import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import axios from "axios"
import { API_URL } from "@/config/api"

function getPastAcademicYearRange() {
  const now = new Date()
  const y = now.getFullYear()
  const month = now.getMonth() + 1 // 1–12
  // Start of current academic year (Aug–Jul): e.g. 2025-08-01 until 2026-07-31, then 2026-08-01
  const sinceYear = month >= 8 ? y : y - 1
  const staleSince = `${sinceYear}-08-01`
  const today = now.toISOString().slice(0, 10) // YYYY-MM-DD
  return {
    before: `${y - 1}-08-01`, // for old events
    staleSince,
    staleEnd: today, // students with no attendance in [staleSince, today] = haven't attended since staleSince
  }
}

function SettingsPage() {
  const [staleStudents, setStaleStudents] = useState([])
  const [oldEvents, setOldEvents] = useState([])
  const [loadingStale, setLoadingStale] = useState(false)
  const [loadingOld, setLoadingOld] = useState(false)
  const [deletingAllStudents, setDeletingAllStudents] = useState(false)
  const [deletingAllEvents, setDeletingAllEvents] = useState(false)
  const [deletingEventId, setDeletingEventId] = useState(null)
  const [deletingStudentId, setDeletingStudentId] = useState(null)
  const { toast } = useToast()
  const { user } = useAuth()

  const range = getPastAcademicYearRange()

  const fetchStaleStudents = useCallback(async () => {
    const headers = user?.token ? { headers: { Authorization: `Bearer ${user.token}` } } : {}
    setLoadingStale(true)
    try {
      const res = await axios.get(
        `${API_URL}/api/students/no-attendance-in-period/?start=${range.staleSince}&end=${range.staleEnd}`,
        headers
      )
      setStaleStudents(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.error || "Failed to load stale students",
        variant: "destructive",
      })
    } finally {
      setLoadingStale(false)
    }
  }, [range.staleSince, range.staleEnd, user?.token, toast])

  const fetchOldEvents = useCallback(async () => {
    const headers = user?.token ? { headers: { Authorization: `Bearer ${user.token}` } } : {}
    setLoadingOld(true)
    try {
      const res = await axios.get(
        `${API_URL}/api/events/before/?before=${range.before}`,
        headers
      )
      setOldEvents(Array.isArray(res.data) ? res.data : res.data?.results ?? [])
    } catch (e) {
      toast({
        title: "Error",
        description: e.response?.data?.error || "Failed to load old events",
        variant: "destructive",
      })
    } finally {
      setLoadingOld(false)
    }
  }, [range.before, user?.token, toast])

  useEffect(() => {
    fetchStaleStudents()
  }, [fetchStaleStudents])

  useEffect(() => {
    fetchOldEvents()
  }, [fetchOldEvents])

  const authHeaders = user?.token ? { headers: { Authorization: `Bearer ${user.token}` } } : {}

  const handleDeleteAllStaleStudents = async () => {
    if (staleStudents.length === 0) return
    if (!confirm(`Delete all ${staleStudents.length} listed students and their accounts? This cannot be undone.`)) return
    const scrollY = window.scrollY
    setDeletingAllStudents(true)
    let done = 0
    for (const s of staleStudents) {
      try {
        await axios.delete(`${API_URL}/api/students/${s.id}/`, authHeaders)
        done++
      } catch (e) {
        toast({
          title: "Error",
          description: `Failed to delete ${s.first_name} ${s.last_name}: ${e.response?.data?.error || e.message}`,
          variant: "destructive",
        })
      }
    }
    if (done > 0) {
      toast({ title: "Deleted", description: `${done} student(s) deleted.` })
      await fetchStaleStudents()
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollY)))
    }
    setDeletingAllStudents(false)
  }

  const handleDeleteAllOldEvents = async () => {
    if (oldEvents.length === 0) return
    if (!confirm(`Delete all ${oldEvents.length} listed events and their attendances? This cannot be undone.`)) return
    const scrollY = window.scrollY
    setDeletingAllEvents(true)
    let done = 0
    for (const e of oldEvents) {
      try {
        await axios.delete(`${API_URL}/api/events/${e.id}/`, authHeaders)
        done++
      } catch (err) {
        toast({
          title: "Error",
          description: `Failed to delete event: ${err.response?.data?.error || err.message}`,
          variant: "destructive",
        })
      }
    }
    if (done > 0) {
      toast({ title: "Deleted", description: `${done} event(s) deleted.` })
      await fetchOldEvents()
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollY)))
    }
    setDeletingAllEvents(false)
  }

  const handleDeleteOneStudent = async (student) => {
    if (!student?.id) return
    const name = [student.first_name, student.last_name].filter(Boolean).join(" ") || "Student"
    if (!confirm(`Delete ${name} and their account? This cannot be undone.`)) return
    const scrollY = window.scrollY
    setDeletingStudentId(student.id)
    try {
      await axios.delete(`${API_URL}/api/students/${student.id}/`, authHeaders)
      toast({ title: "Deleted", description: "Student deleted." })
      await fetchStaleStudents()
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollY)))
    } catch (err) {
      toast({
        title: "Error",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      })
    } finally {
      setDeletingStudentId(null)
    }
  }

  const handleDeleteOneEvent = async (event) => {
    if (!event?.id) return
    if (!confirm(`Delete "${event.name}" (${event.date ? new Date(event.date).toLocaleDateString() : "—"})? Attendances will be removed.`)) return
    const scrollY = window.scrollY
    setDeletingEventId(event.id)
    try {
      await axios.delete(`${API_URL}/api/events/${event.id}/`, authHeaders)
      toast({ title: "Deleted", description: "Event deleted." })
      await fetchOldEvents()
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, scrollY)))
    } catch (err) {
      toast({
        title: "Error",
        description: err.response?.data?.error || err.message,
        variant: "destructive",
      })
    } finally {
      setDeletingEventId(null)
    }
  }

  const aNumber = (s) => s?.username || s?.user?.username || ""

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Students with no attendance since {range.staleSince}</CardTitle>
                <CardDescription>
                  Marked outside the current academic year
                </CardDescription>
              </div>
              {staleStudents.length > 0 && (
                <Button
                  variant="destructive"
                  disabled={loadingStale || deletingAllStudents}
                  onClick={handleDeleteAllStaleStudents}
                >
                  {deletingAllStudents ? "Deleting…" : "Delete all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingStale ? (
              <p className="text-slate-500">Loading…</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>A-Number</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staleStudents.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.first_name} {s.last_name}</TableCell>
                        <TableCell>{aNumber(s)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deletingStudentId === s.id || deletingAllStudents}
                            onClick={() => handleDeleteOneStudent(s)}
                          >
                            {deletingStudentId === s.id ? "Deleting…" : "Delete"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {staleStudents.length === 0 && (
                  <p className="text-slate-500 py-4">No students with zero attendance in that period.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Events before {range.before}</CardTitle>
                <CardDescription>
                  Marked outside the current academic year
                </CardDescription>
              </div>
              {oldEvents.length > 0 && (
                <Button
                  variant="destructive"
                  disabled={loadingOld || deletingAllEvents}
                  onClick={handleDeleteAllOldEvents}
                >
                  {deletingAllEvents ? "Deleting…" : "Delete all"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingOld ? (
              <p className="text-slate-500">Loading…</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {oldEvents.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.name}</TableCell>
                        <TableCell>{e.date ? new Date(e.date).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={deletingEventId === e.id || deletingAllEvents}
                            onClick={() => handleDeleteOneEvent(e)}
                          >
                            {deletingEventId === e.id ? "Deleting…" : "Delete"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {oldEvents.length === 0 && (
                  <p className="text-slate-500 py-4">No events before that date.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SettingsPage
