import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import axios from "axios"
import { API_URL } from '@/config/api'
import { useAuth } from "@/hooks/useAuth"

function CreateEvent({ onCreateEvent, initialData }) {
  const [eventData, setEventData] = useState({
    organization: "",
    event_type: "",
    function: "",
    name: "",
    description: "",
    location: "",
    points: "",
    date: "",
  })
  const [organizations, setOrganizations] = useState([])
  const [functions, setFunctions] = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const { user } = useAuth()

  useEffect(() => {
    fetchDropdownData()
  }, [])

  useEffect(() => {
    if (initialData) {
      setEventData({
        organization: initialData.organization || "",
        event_type: initialData.event_type || "",
        function: initialData.function || "",
        name: initialData.name,
        description: initialData.description || "",
        location: initialData.location,
        points: initialData.points.toString(),
        date: new Date(initialData.date).toISOString().slice(0, 16), // Format for datetime-local input
      })
    }
  }, [initialData])

  const fetchDropdownData = async () => {
    try {
      const authHeaders = {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      }
      
      const [organizationsRes, functionsRes, eventTypesRes] = await Promise.all([
        axios.get(`${API_URL}/api/events/organizations`, authHeaders),
        axios.get(`${API_URL}/api/events/all_functions`, authHeaders), // Use universal functions
        axios.get(`${API_URL}/api/events/types`, authHeaders)
      ])
      setOrganizations(organizationsRes.data)
      setFunctions(functionsRes.data)
      setEventTypes(eventTypesRes.data)
    } catch (error) {
      console.error('Error fetching dropdown data:', error)
    }
  }


  const handleSubmit = (e) => {
    e.preventDefault()
    onCreateEvent({
      ...eventData,
      points: parseInt(eventData.points),
      date: new Date(eventData.date).toISOString(),
    })
    if (!initialData) {
      setEventData({ organization: "", event_type: "", function: "", name: "", description: "", location: "", points: "", date: "" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Organization</label>
        <Select
          value={eventData.organization}
          onValueChange={(value) => setEventData({ ...eventData, organization: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org, index) => (
              <SelectItem key={`org-${index}`} value={org}>
                {org}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Event Type</label>
        <Select
          value={eventData.event_type}
          onValueChange={(value) => setEventData({ ...eventData, event_type: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an event type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((type, index) => (
              <SelectItem key={`type-${index}`} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Function</label>
        <Select
          value={eventData.function}
          onValueChange={(value) => setEventData({ ...eventData, function: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a function" />
          </SelectTrigger>
          <SelectContent>
            {functions.map((func, index) => (
              <SelectItem key={`func-${index}`} value={func}>
                {func}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Event Name</label>
        <Input
          type="text"
          value={eventData.name}
          onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          value={eventData.description}
          onChange={(e) => setEventData({ ...eventData, description: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Location</label>
        <Input
          type="text"
          value={eventData.location}
          onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Points</label>
        <Input
          type="number"
          value={eventData.points}
          onChange={(e) => setEventData({ ...eventData, points: e.target.value })}
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Date and Time</label>
        <Input
          type="datetime-local"
          value={eventData.date}
          onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
          required
        />
      </div>

      <Button type="submit" className="w-full">
        {initialData ? 'Update Event' : 'Create Event'}
      </Button>
    </form>
  )
}

export default CreateEvent