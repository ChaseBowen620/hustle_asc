import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
    name: "",
    description: "",
    location: "",
    date: "",
    is_recurring: false,
    recurrence_type: "none",
    recurrence_end_date: "",
  })
  const [organizations, setOrganizations] = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const [isCustomEventType, setIsCustomEventType] = useState(false)
  const [customEventType, setCustomEventType] = useState("")
  const { user } = useAuth()

  useEffect(() => {
    fetchDropdownData()
  }, [])

  useEffect(() => {
    if (initialData && organizations.length > 0 && eventTypes.length > 0) {
      console.log('Populating form with initial data:', initialData)
      
      // Check if the event type is a custom one (not in the predefined list)
      const isCustomType = initialData.event_type && !eventTypes.includes(initialData.event_type)
      
      setEventData({
        organization: initialData.organization || "",
        event_type: initialData.event_type || "",
        name: initialData.name,
        description: initialData.description || "",
        location: initialData.location,
        date: new Date(initialData.date).toISOString().slice(0, 16), // Format for datetime-local input
        is_recurring: initialData.is_recurring || false,
        recurrence_type: initialData.recurrence_type || "none",
        recurrence_end_date: initialData.recurrence_end_date ? new Date(initialData.recurrence_end_date).toISOString().slice(0, 16) : "",
      })
      
      if (isCustomType) {
        setIsCustomEventType(true)
        setCustomEventType(initialData.event_type)
      }
    }
  }, [initialData, organizations, eventTypes])

  const fetchDropdownData = async () => {
    try {
      const authHeaders = {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      }
      
      const [organizationsRes, eventTypesRes] = await Promise.all([
        axios.get(`${API_URL}/api/events/organizations`, authHeaders),
        axios.get(`${API_URL}/api/events/types`, authHeaders)
      ])
      setOrganizations(organizationsRes.data)
      setEventTypes(eventTypesRes.data)
    } catch (error) {
      console.error('Error fetching dropdown data:', error)
    }
  }


  const handleEventTypeChange = (value) => {
    if (value === "custom") {
      setIsCustomEventType(true)
      setEventData({ ...eventData, event_type: "" })
    } else {
      setIsCustomEventType(false)
      setCustomEventType("")
      setEventData({ ...eventData, event_type: value })
    }
  }

  const handleCustomEventTypeChange = (value) => {
    setCustomEventType(value)
    setEventData({ ...eventData, event_type: value })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onCreateEvent({
      ...eventData,
      date: new Date(eventData.date).toISOString(),
    })
    if (!initialData) {
      setEventData({ 
        organization: "", 
        event_type: "", 
        name: "", 
        description: "", 
        location: "", 
        date: "",
        is_recurring: false,
        recurrence_type: "none",
        recurrence_end_date: ""
      })
      setIsCustomEventType(false)
      setCustomEventType("")
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
        {!isCustomEventType ? (
          <Select
            value={eventData.event_type}
            onValueChange={handleEventTypeChange}
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
              <SelectItem value="custom" className="text-blue-600 font-medium">
                + Other (Custom)
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="space-y-2">
            <Input
              type="text"
              value={customEventType}
              onChange={(e) => handleCustomEventTypeChange(e.target.value)}
              placeholder="Enter custom event type"
              required
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setIsCustomEventType(false)
                setCustomEventType("")
                setEventData({ ...eventData, event_type: "" })
              }}
              className="text-sm"
            >
              ← Back to dropdown
            </Button>
          </div>
        )}
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
        <label className="text-sm font-medium">Date and Time</label>
        <Input
          type="datetime-local"
          value={eventData.date}
          onChange={(e) => setEventData({ ...eventData, date: e.target.value })}
          required
        />
      </div>

      {/* Recurring Event Options */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="is_recurring"
            checked={eventData.is_recurring}
            onCheckedChange={(checked) => setEventData({ ...eventData, is_recurring: checked })}
          />
          <Label htmlFor="is_recurring" className="text-sm font-medium">
            Make this a recurring event
          </Label>
        </div>

        {eventData.is_recurring && (
          <div className="space-y-4 pl-6 border-l-2 border-gray-200">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Recurrence Frequency</Label>
              <Select
                value={eventData.recurrence_type}
                onValueChange={(value) => setEventData({ ...eventData, recurrence_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recurrence frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">End Date (Optional)</Label>
              <Input
                type="datetime-local"
                value={eventData.recurrence_end_date}
                onChange={(e) => setEventData({ ...eventData, recurrence_end_date: e.target.value })}
                placeholder="Leave empty for no end date"
              />
              <p className="text-xs text-gray-500">
                If no end date is specified, events will be created for 1 year from the start date.
              </p>
            </div>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full">
        {initialData ? 'Update Event' : 'Create Event'}
      </Button>
    </form>
  )
}

export default CreateEvent