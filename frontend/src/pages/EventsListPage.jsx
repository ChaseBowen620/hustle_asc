import { useState, useEffect, useRef, useCallback } from "react"
import axios from "axios"
import { format } from "date-fns"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Edit2, Check, X, Trash2, Download, Loader2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { API_URL } from '@/config/api'
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"

const PAGE_SIZE = 10

function EventsListPage() {
  const [events, setEvents] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [editingField, setEditingField] = useState(null) // { eventId: number, field: 'organization' | 'name' | 'date' }
  const [editValues, setEditValues] = useState({
    organization: "",
    secondaryOrganizationIds: [],
    name: "",
    date: ""
  })
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [downloadingCsv, setDownloadingCsv] = useState(null) // event id while downloading
  const [nextPage, setNextPage] = useState(null) // 2, 3, ... or null when no more
  const loadMoreRef = useRef(null)
  const { toast } = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()

  // Edit Organizations dialog (manage organization table)
  const [showEditOrganizationsDialog, setShowEditOrganizationsDialog] = useState(false)
  const [manageOrgsList, setManageOrgsList] = useState([])
  const [newOrgName, setNewOrgName] = useState("")
  const [isCreatingOrg, setIsCreatingOrg] = useState(false)
  const [editingOrgId, setEditingOrgId] = useState(null)
  const [editingOrgName, setEditingOrgName] = useState("")

  const fetchEvents = useCallback(async (reset = true) => {
    if (reset) {
      setLoading(true)
      setNextPage(null)
    }
    try {
      const page = reset ? 1 : nextPage
      const url = `${API_URL}/api/events/?page=${page || 1}`
      const eventsRes = await axios.get(url)
      const data = eventsRes.data
      const results = data.results ?? data
      const newEvents = Array.isArray(results) ? results : []

      if (reset) {
        setEvents(newEvents)
      } else {
        setEvents(prev => [...prev, ...newEvents])
      }

      const hasNext = !!data.next
      setNextPage(hasNext && newEvents.length === PAGE_SIZE ? (page || 1) + 1 : null)
    } catch (error) {
      console.error('Error fetching events:', error)
      toast({
        title: "Error",
        description: "Failed to load events.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [nextPage, toast])

  const loadMore = useCallback(async () => {
    if (!nextPage || loadingMore || loading) return
    setLoadingMore(true)
    try {
      const eventsRes = await axios.get(`${API_URL}/api/events/?page=${nextPage}`)
      const data = eventsRes.data
      const results = data.results ?? data
      const newEvents = Array.isArray(results) ? results : []

      setEvents(prev => [...prev, ...newEvents])
      const hasNext = !!data.next
      setNextPage(hasNext && newEvents.length === PAGE_SIZE ? nextPage + 1 : null)
    } catch (error) {
      console.error('Error fetching more events:', error)
      toast({
        title: "Error",
        description: "Failed to load more events.",
        variant: "destructive"
      })
    } finally {
      setLoadingMore(false)
    }
  }, [nextPage, loadingMore, loading, toast])

  const authHeaders = user?.token ? { headers: { Authorization: `Bearer ${user.token}` } } : {}

  const fetchManageOrganizations = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/organizations/`, authHeaders)
      setManageOrgsList(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      const status = err.response?.status
      const msg = status === 401
        ? 'Please log in to manage organizations.'
        : (err.response?.data?.error || 'Failed to load organizations')
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }, [user?.token, toast])

  const fetchEventsOrgs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/events/organizations`)
      setOrganizations(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Error fetching organizations for events:', err)
    }
  }, [])

  const handleCreateOrganization = useCallback(async () => {
    if (!newOrgName.trim()) {
      toast({ title: 'Error', description: 'Organization name is required', variant: 'destructive' })
      return
    }
    setIsCreatingOrg(true)
    try {
      await axios.post(`${API_URL}/api/organizations/`, { name: newOrgName.trim() }, authHeaders)
      toast({ title: 'Success', description: 'Organization created successfully' })
      setNewOrgName('')
      await fetchManageOrganizations()
      await fetchEventsOrgs()
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to create organization'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setIsCreatingOrg(false)
    }
  }, [newOrgName, authHeaders, fetchManageOrganizations, fetchEventsOrgs, toast])

  const handleUpdateOrganization = useCallback(async (orgId, name) => {
    if (!name?.trim()) {
      toast({ title: 'Error', description: 'Organization name is required', variant: 'destructive' })
      return
    }
    try {
      await axios.patch(`${API_URL}/api/organizations/${orgId}/`, { name: name.trim() }, authHeaders)
      toast({ title: 'Success', description: 'Organization updated successfully' })
      setEditingOrgId(null)
      setEditingOrgName('')
      await fetchManageOrganizations()
      await fetchEventsOrgs()
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update organization'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }, [authHeaders, fetchManageOrganizations, fetchEventsOrgs, toast])

  const handleDeleteOrganization = useCallback(async (orgId) => {
    if (!window.confirm('Are you sure you want to delete this organization?')) return
    try {
      await axios.delete(`${API_URL}/api/organizations/${orgId}/`, authHeaders)
      toast({ title: 'Success', description: 'Organization deleted successfully' })
      await fetchManageOrganizations()
      await fetchEventsOrgs()
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete organization'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    }
  }, [authHeaders, fetchManageOrganizations, fetchEventsOrgs, toast])

  useEffect(() => {
    fetchEvents(true)
  }, [])

  useEffect(() => {
    if (showEditOrganizationsDialog) fetchManageOrganizations()
  }, [showEditOrganizationsDialog, fetchManageOrganizations])

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/events/organizations`)
        setOrganizations(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        console.error('Error fetching organizations:', err)
      }
    }
    fetchOrgs()
  }, [])

  // Infinite scroll: load more when sentinel is visible
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !nextPage || loadingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '100px', threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [nextPage, loadingMore, loadMore])



  // Direct CSV download from backend (no list loaded on frontend)
  const handleDownloadAttendanceCSV = useCallback(async (event) => {
    const count = event.attendance_count ?? 0
    if (!event?.id || count === 0) {
      toast({
        title: "No attendees",
        description: "There are no attendees to download for this event.",
        variant: "destructive"
      })
      return
    }
    setDownloadingCsv(event.id)
    try {
      const res = await axios.get(`${API_URL}/api/events/${event.id}/attendance/export/`, {
        responseType: 'blob',
        withCredentials: true
      })
      const blob = res.data
      const disposition = res.headers['content-disposition']
      let filename = `${event.name}_Attendance_${format(new Date(event.date), 'M-d-yy')}.csv`.replace(/[/\\?%*:|"<>]/g, '-')
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^";\n]+)"?/)
        if (match) filename = match[1].trim()
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      toast({ title: "Download started", description: "Attendance CSV is downloading." })
    } catch (err) {
      console.error('Error downloading CSV:', err)
      toast({
        title: "Error",
        description: "Failed to download attendance CSV.",
        variant: "destructive"
      })
    } finally {
      setDownloadingCsv(null)
    }
  }, [toast])

  const handleEditClick = (event, field) => {
    setEditingField({ eventId: event.id, field })
    
    if (field === 'date') {
      // Format date for input (YYYY-MM-DDTHH:mm) - preserve local time
      const eventDate = new Date(event.date)
      // Get local date/time components without timezone conversion
      const year = eventDate.getFullYear()
      const month = String(eventDate.getMonth() + 1).padStart(2, '0')
      const day = String(eventDate.getDate()).padStart(2, '0')
      const hours = String(eventDate.getHours()).padStart(2, '0')
      const minutes = String(eventDate.getMinutes()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}T${hours}:${minutes}`
      setEditValues({
        ...editValues,
        date: dateString
      })
    } else if (field === 'organization') {
      const secondaryIds = (event.event_organizations || []).map(eo => eo.organization_id ?? eo.organization?.id).filter(Boolean)
      setEditValues({
        ...editValues,
        organization: event.organization || "",
        secondaryOrganizationIds: secondaryIds
      })
    } else if (field === 'name') {
      setEditValues({
        ...editValues,
        name: event.name
      })
    }
  }

  const handleCancelEdit = () => {
    setEditingField(null)
    setEditValues({
      organization: "",
      secondaryOrganizationIds: [],
      name: "",
      date: ""
    })
  }

  const handleSaveEdit = async (eventId, field) => {
    const event = events.find(e => e.id === eventId)
    if (!event) return

    // Validate the field being edited
    if (field === 'organization' && !editValues.organization.trim()) {
      toast({
        title: "Error",
        description: "Primary organization is required",
        variant: "destructive"
      })
      return
    }

    if (field === 'name' && !editValues.name.trim()) {
      toast({
        title: "Error",
        description: "Event name cannot be empty",
        variant: "destructive"
      })
      return
    }

    if (field === 'date' && !editValues.date) {
      toast({
        title: "Error",
        description: "Event date is required",
        variant: "destructive"
      })
      return
    }

    setIsSaving(true)
    try {
      // Prepare update payload - only update the field being edited
      const updatePayload = {}
      
      if (field === 'organization') {
        updatePayload.organization = editValues.organization.trim()
        updatePayload.organizations = editValues.secondaryOrganizationIds ?? []
      } else if (field === 'name') {
        updatePayload.name = editValues.name.trim()
      } else if (field === 'date') {
        // Format date for API - preserve the date/time values as-is
        const [datePart, timePart] = editValues.date.split('T')
        const [year, month, day] = datePart.split('-')
        const [hours, minutes] = (timePart || '00:00').split(':')
        // Format as ISO string (backend will interpret this in its timezone)
        const isoDate = `${year}-${month}-${day}T${hours}:${minutes}:00`
        updatePayload.date = isoDate
      }

      const res = await axios.patch(`${API_URL}/api/events/${eventId}/`, updatePayload)
      const updated = res.data

      // Update local state (use server response so event_organizations is correct)
      setEvents(events.map(e => (e.id === eventId ? { ...e, ...updated } : e)))

      setEditingField(null)
      setEditValues({
        organization: "",
        secondaryOrganizationIds: [],
        name: "",
        date: ""
      })

      toast({
        title: "Success",
        description: "Event updated successfully",
      })
    } catch (error) {
      console.error('Error updating event:', error)
      toast({
        title: "Error",
        description: "Failed to update event. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    setIsSaving(true)
    try {
      await axios.delete(`${API_URL}/api/events/${eventId}/`)

      // Remove event from local state
      setEvents(events.filter(e => e.id !== eventId))

      // Exit edit mode if we were editing this event
      if (editingField?.eventId === eventId) {
        setEditingField(null)
        setEditValues({
          organization: "",
          secondaryOrganizationIds: [],
          name: "",
          date: ""
        })
      }

      toast({
        title: "Success",
        description: "Event deleted successfully",
      })
    } catch (error) {
      console.error('Error deleting event:', error)
      toast({
        title: "Error",
        description: "Failed to delete event. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredEvents = events
    .filter(event => 
      event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.organization.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      // Descending for past events (most recent first)
      return dateB - dateA
    })

  const EventsTable = ({ events, showAttendance }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Organization(s)</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Date</TableHead>
          {showAttendance && <TableHead>Attendance</TableHead>}
          <TableHead className="w-[100px]">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => {
          const isEditingOrg = editingField?.eventId === event.id && editingField?.field === 'organization'
          const isEditingName = editingField?.eventId === event.id && editingField?.field === 'name'
          const isEditingDate = editingField?.eventId === event.id && editingField?.field === 'date'
          
          return (
          <TableRow key={event.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <span>
                  {event.organization}
                  {(event.event_organizations?.length ?? 0) > 0 && (
                    <span className="text-muted-foreground">
                      {" "}({(event.event_organizations || []).map(eo => eo.organization_name ?? eo.organization?.name).filter(Boolean).join(", ")})
                    </span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEditClick(event, 'organization')}
                  className="h-6 w-6 p-0"
                  title="Edit Organization(s)"
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {isEditingName ? (
                  <Input
                    value={editValues.name}
                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                    className="flex-1"
                    disabled={isSaving}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveEdit(event.id, 'name')
                      } else if (e.key === 'Escape') {
                        handleCancelEdit()
                      }
                    }}
                    autoFocus
                  />
                ) : (
                  <span className="flex-1">{event.name}</span>
                )}
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveEdit(event.id, 'name')}
                      disabled={isSaving}
                      className="h-6 w-6 p-0"
                      title="Save"
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="h-6 w-6 p-0"
                      title="Cancel"
                    >
                      <X className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditClick(event, 'name')}
                    className="h-6 w-6 p-0"
                    title="Edit Name"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {isEditingDate ? (
                  <div className="flex gap-2 flex-1">
                    <Input
                      type="date"
                      value={editValues.date.split('T')[0]}
                      onChange={(e) => {
                        const timePart = editValues.date.includes('T') ? editValues.date.split('T')[1] : '00:00'
                        setEditValues({ ...editValues, date: `${e.target.value}T${timePart}` })
                      }}
                      className="flex-1"
                      disabled={isSaving}
                    />
                    <Input
                      type="time"
                      value={editValues.date.includes('T') ? editValues.date.split('T')[1] : '00:00'}
                      onChange={(e) => {
                        const datePart = editValues.date.split('T')[0]
                        setEditValues({ ...editValues, date: `${datePart}T${e.target.value}` })
                      }}
                      className="flex-1"
                      disabled={isSaving}
                    />
                  </div>
                ) : (
                  <>
                    <span className="sm:hidden">
                      {format(new Date(event.date), 'MMM d, yyyy')}
                    </span>
                    <span className="hidden sm:inline">
                      {format(new Date(event.date), 'MMM d, yyyy h:mm a')}
                    </span>
                  </>
                )}
                {isEditingDate ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSaveEdit(event.id, 'date')}
                      disabled={isSaving}
                      className="h-6 w-6 p-0"
                      title="Save"
                    >
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="h-6 w-6 p-0"
                      title="Cancel"
                    >
                      <X className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditClick(event, 'date')}
                    className="h-6 w-6 p-0"
                    title="Edit Date"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </TableCell>
            {showAttendance && (
              <TableCell>
                <button
                  className={`${(event.attendance_count ?? 0) > 0 
                    ? "bg-slate-50 hover:bg-slate-300 transition-colors px-3 py-1 rounded border"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed px-3 py-1 rounded border"
                  }`}
                  onClick={() => handleDownloadAttendanceCSV(event)}
                  disabled={(event.attendance_count ?? 0) === 0 || downloadingCsv === event.id}
                  title="Download attendance CSV"
                >
                  {downloadingCsv === event.id ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : (
                    <>
                      {event.attendance_count ?? 0} <Download className="h-4 w-4 inline ml-1" />
                    </>
                  )}
                </button>
              </TableCell>
            )}
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigate(`/events/${event.id}/edit`)}
                  disabled={isSaving || isEditingOrg || isEditingName || isEditingDate}
                  className="h-8 w-8 p-0"
                  title="Edit event / View who checked in"
                >
                  <Edit2 className="h-4 w-4 text-slate-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteEvent(event.id)}
                  disabled={isSaving || isEditingOrg || isEditingName || isEditingDate}
                  className="h-8 w-8 p-0"
                  title="Delete Event"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )})}
      </TableBody>
    </Table>
  )

  const orgDialogEventId = editingField?.field === 'organization' ? editingField.eventId : null

  return (
    <div className="space-y-6">
      <Dialog
        open={editingField?.field === 'organization'}
        onOpenChange={(open) => { if (!open) handleCancelEdit() }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit organizations</DialogTitle>
            <DialogDescription>
              Choose the primary organization and any secondary organizations for this event.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="primary-org">Primary organization</Label>
              <Select
                value={editValues.organization || ""}
                onValueChange={(v) => setEditValues({ ...editValues, organization: v })}
                disabled={isSaving}
              >
                <SelectTrigger id="primary-org" className="w-full">
                  <SelectValue placeholder="Select primary organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.name}>{org.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Secondary organizations</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {organizations
                  .filter((o) => o.name !== editValues.organization)
                  .map((org) => (
                    <label key={org.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1">
                      <Checkbox
                        checked={(editValues.secondaryOrganizationIds || []).includes(org.id)}
                        onCheckedChange={(checked) => {
                          const ids = editValues.secondaryOrganizationIds || []
                          setEditValues({
                            ...editValues,
                            secondaryOrganizationIds: checked
                              ? [...ids, org.id]
                              : ids.filter((id) => id !== org.id)
                          })
                        }}
                      />
                      <span className="text-sm">{org.name}</span>
                    </label>
                  ))}
                {organizations.filter((o) => o.name !== editValues.organization).length === 0 && (
                  <p className="text-sm text-muted-foreground">No other organizations to select.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={() => orgDialogEventId && handleSaveEdit(orgDialogEventId, 'organization')}
              disabled={isSaving || !editValues.organization?.trim()}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Organizations dialog – change names, add, delete organizations */}
      <Dialog open={showEditOrganizationsDialog} onOpenChange={setShowEditOrganizationsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Organizations</DialogTitle>
            <DialogDescription>
              Change the name of each organization, add new ones, or delete organizations from the table.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-2">
            <div>
              <h3 className="text-sm font-semibold mb-3">Current organizations</h3>
              {manageOrgsList.length === 0 ? (
                <p className="text-muted-foreground text-sm">No organizations yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-[180px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manageOrgsList.map((org) => (
                      <TableRow key={org.id}>
                        <TableCell>
                          {editingOrgId === org.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editingOrgName}
                                onChange={(e) => setEditingOrgName(e.target.value)}
                                className="max-w-xs"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateOrganization(org.id, editingOrgName)
                                  if (e.key === 'Escape') { setEditingOrgId(null); setEditingOrgName('') }
                                }}
                                autoFocus
                              />
                              <Button size="sm" onClick={() => handleUpdateOrganization(org.id, editingOrgName)} disabled={!editingOrgName?.trim()}>
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingOrgId(null); setEditingOrgName('') }}>
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <span>{org.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingOrgId === org.id ? null : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="mr-1"
                                onClick={() => { setEditingOrgId(org.id); setEditingOrgName(org.name || '') }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDeleteOrganization(org.id)}
                              >
                                Delete
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Add organization</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Organization name"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateOrganization()}
                  className="max-w-xs"
                />
                <Button onClick={handleCreateOrganization} disabled={isCreatingOrg}>
                  {isCreatingOrg ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Events</h1>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-gray-500" />
          <Input
            placeholder="Search by name or organization..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="min-w-[280px] max-w-md"
          />
        </div>
        <Button onClick={() => setShowEditOrganizationsDialog(true)}>
          Edit Organizations
        </Button>
      </div>

          <div className="border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
                <span className="ml-3 text-slate-500">Loading events...</span>
              </div>
            ) : (
              <>
                <EventsTable events={filteredEvents} showAttendance={true} />
                <div ref={loadMoreRef} className="min-h-[40px] flex items-center justify-center py-4">
                  {loadingMore && (
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  )}
                </div>
              </>
            )}
          </div>

    </div>
  )
}

export default EventsListPage 