import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

function CreateEvent({ onCreateEvent, initialData }) {
  const [eventData, setEventData] = useState({
    name: "",
    description: "",
    location: "",
    points: "",
    date: "",
  })

  useEffect(() => {
    if (initialData) {
      setEventData({
        name: initialData.name,
        description: initialData.description || "",
        location: initialData.location,
        points: initialData.points.toString(),
        date: new Date(initialData.date).toISOString().slice(0, 16), // Format for datetime-local input
      })
    }
  }, [initialData])

  const handleSubmit = (e) => {
    e.preventDefault()
    onCreateEvent({
      ...eventData,
      points: parseInt(eventData.points),
      date: new Date(eventData.date).toISOString(),
    })
    if (!initialData) {
      setEventData({ name: "", description: "", location: "", points: "", date: "" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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