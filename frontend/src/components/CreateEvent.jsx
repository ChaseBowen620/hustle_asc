import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import axios from "axios"
import { API_URL } from '@/config/api'

function CreateEvent({ onCreateEvent, initialData }) {
  const [eventTypes, setEventTypes] = useState([])
  const [eventData, setEventData] = useState({
    event_type: "",
    name: "",
    description: "",
    location: "",
    points: "",
    date: "",
  })

  useEffect(() => {
    if (initialData) {
      setEventData({
        event_type: initialData.event_type,
        name: initialData.name,
        description: initialData.description || "",
        location: initialData.location,
        points: initialData.points.toString(),
        date: new Date(initialData.date).toISOString().slice(0, 16), // Format for datetime-local input
      })
    }
  }, [initialData])

  useEffect(() => {
    // Fetch event types when component mounts
    const fetchEventTypes = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/event-types/`)
        setEventTypes(response.data)
      } catch (error) {
        console.error('Error fetching event types:', error)
      }
    }
    fetchEventTypes()
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    onCreateEvent({
      ...eventData,
      points: parseInt(eventData.points),
      date: new Date(eventData.date).toISOString(),
    })
    if (!initialData) {
      setEventData({ event_type: "", name: "", description: "", location: "", points: "", date: "" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Event Type</label>
        <select
          value={eventData.event_type}
          onChange={(e) => setEventData({ ...eventData, event_type: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2"
          required
        >
          <option value="">Select Event Type</option>
          {eventTypes.map(type => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
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