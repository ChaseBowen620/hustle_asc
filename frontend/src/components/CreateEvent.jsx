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

// Helper function to get the next hour in Mountain Time, rounded up
function getNextHourInMountainTime() {
  // Get current time in Mountain Time (America/Denver timezone)
  const now = new Date()
  
  // Get Mountain Time string components
  const mountainTimeString = now.toLocaleString("en-US", { 
    timeZone: "America/Denver",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  // Parse the Mountain Time string (format: MM/DD/YYYY, HH:MM)
  const [datePart, timePart] = mountainTimeString.split(', ')
  const [month, day, year] = datePart.split('/').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  
  // Round up to the next hour
  let nextHour = hours + 1
  let nextDay = day
  let nextMonth = month
  let nextYear = year
  
  if (nextHour >= 24) {
    nextHour = 0
    nextDay++
    // Handle month/year rollover (simplified - assumes not crossing year boundary in practice)
    const daysInMonth = new Date(year, month, 0).getDate()
    if (nextDay > daysInMonth) {
      nextDay = 1
      nextMonth++
      if (nextMonth > 12) {
        nextMonth = 1
        nextYear++
      }
    }
  }
  
  // Format for datetime-local input (YYYY-MM-DDTHH:MM)
  const yearStr = String(nextYear)
  const monthStr = String(nextMonth).padStart(2, '0')
  const dayStr = String(nextDay).padStart(2, '0')
  const hoursStr = String(nextHour).padStart(2, '0')
  const minutesStr = '00'
  
  return `${yearStr}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}`
}

// Helper function to convert datetime-local value (treated as Mountain Time) to ISO string (UTC)
function mountainTimeToISO(datetimeLocal) {
  if (!datetimeLocal) return ""
  
  // Parse the datetime-local string (assumes it represents Mountain Time)
  const [datePart, timePart] = datetimeLocal.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  
  // Create a UTC date that represents midnight on this date
  // Then we'll calculate the offset by seeing what time it is in Mountain Time
  const dateString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  
  // Try different UTC times until we find one that displays as our desired Mountain Time
  // We know it's roughly UTC-7 (MST) or UTC-6 (MDT), so we'll try both
  // Start by assuming UTC-7 (MST)
  let testUTC = new Date(`${dateString}Z`)
  testUTC.setUTCHours(testUTC.getUTCHours() + 7) // Add 7 hours assuming MST
  
  // Check if this UTC time, when converted to Mountain Time, matches our input
  let mountainCheck = testUTC.toLocaleString("en-US", {
    timeZone: "America/Denver",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  const [checkDatePart, checkTimePart] = mountainCheck.split(', ')
  const [checkMonth, checkDay, checkYear] = checkDatePart.split('/').map(Number)
  const [checkHours, checkMinutes] = checkTimePart.split(':').map(Number)
  
  // If it matches, we're done
  if (checkYear === year && checkMonth === month && checkDay === day && 
      checkHours === hours && checkMinutes === minutes) {
    return testUTC.toISOString()
  }
  
  // Try UTC-6 (MDT)
  testUTC = new Date(`${dateString}Z`)
  testUTC.setUTCHours(testUTC.getUTCHours() + 6) // Add 6 hours assuming MDT
  
  mountainCheck = testUTC.toLocaleString("en-US", {
    timeZone: "America/Denver",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  const [checkDatePart2, checkTimePart2] = mountainCheck.split(', ')
  const [checkMonth2, checkDay2, checkYear2] = checkDatePart2.split('/').map(Number)
  const [checkHours2, checkMinutes2] = checkTimePart2.split(':').map(Number)
  
  // If it matches, return it
  if (checkYear2 === year && checkMonth2 === month && checkDay2 === day && 
      checkHours2 === hours && checkMinutes2 === minutes) {
    return testUTC.toISOString()
  }
  
  // If neither worked, calculate the exact offset by iterating
  // Start with a close guess and adjust
  testUTC = new Date(`${dateString}Z`)
  
  // Binary search for the correct UTC time
  for (let offsetHours = 6; offsetHours <= 7; offsetHours += 0.25) {
    const testDate = new Date(`${dateString}Z`)
    testDate.setUTCHours(testDate.getUTCHours() + offsetHours)
    
    const mtCheck = testDate.toLocaleString("en-US", {
      timeZone: "America/Denver",
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
    
    const [mtDatePart, mtTimePart] = mtCheck.split(', ')
    const [mtMonth, mtDay, mtYear] = mtDatePart.split('/').map(Number)
    const [mtHours, mtMinutes] = mtTimePart.split(':').map(Number)
    
    if (mtYear === year && mtMonth === month && mtDay === day && 
        mtHours === hours && mtMinutes === minutes) {
      return testDate.toISOString()
    }
  }
  
  // Fallback: return with 7 hour offset (MST)
  testUTC = new Date(`${dateString}Z`)
  testUTC.setUTCHours(testUTC.getUTCHours() + 7)
  return testUTC.toISOString()
}

// Helper function to convert ISO UTC string to Mountain Time datetime-local string
function isoToMountainTime(isoString) {
  if (!isoString) return ""
  
  const utcDate = new Date(isoString)
  
  // Convert to Mountain Time
  const mountainTimeString = utcDate.toLocaleString("en-US", {
    timeZone: "America/Denver",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  
  // Parse and reformat for datetime-local
  const [datePart, timePart] = mountainTimeString.split(', ')
  const [month, day, year] = datePart.split('/').map(Number)
  const [hours, minutes] = timePart.split(':').map(Number)
  
  const yearStr = String(year)
  const monthStr = String(month).padStart(2, '0')
  const dayStr = String(day).padStart(2, '0')
  const hoursStr = String(hours).padStart(2, '0')
  const minutesStr = String(minutes).padStart(2, '0')
  
  return `${yearStr}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}`
}

function CreateEvent({ onCreateEvent, initialData }) {
  // Initialize date to next hour in Mountain Time if no initialData
  const [eventData, setEventData] = useState({
    organization: "",
    event_type: "",
    name: "",
    description: "",
    location: "",
    date: initialData ? "" : getNextHourInMountainTime(),
    is_recurring: false,
    recurrence_type: "none",
    recurrence_end_date: "",
  })
  const [organizations, setOrganizations] = useState([])
  const [eventTypes, setEventTypes] = useState([])
  const [isCustomEventType, setIsCustomEventType] = useState(false)
  const [customEventType, setCustomEventType] = useState("")
  const [selectedOrganizations, setSelectedOrganizations] = useState([]) // Array of organization IDs
  const { user } = useAuth()
  
  // Check if user is a club leader (not Super Admin, DAISSA, or Faculty)
  const isClubLeader = user?.admin_profile?.role && 
    !['Super Admin', 'DAISSA', 'Faculty'].includes(user.admin_profile.role)

  useEffect(() => {
    fetchDropdownData()
  }, [])

  // Auto-select organization for club leaders when organizations are loaded
  useEffect(() => {
    if (!initialData && organizations.length > 0 && user?.admin_profile?.role) {
      const userRole = user.admin_profile.role
      // If user is a club leader (not Super Admin, DAISSA, or Faculty), pre-select their organization
      const userOrg = organizations.find(org => org.name === userRole)
      if (userOrg && !['Super Admin', 'DAISSA', 'Faculty'].includes(userRole)) {
        setEventData(prev => ({
          ...prev,
          organization: userRole
        }))
        // Don't add to multi-select since it's already the primary organization
        setSelectedOrganizations([])
      }
    }
  }, [organizations, user, initialData])

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
        date: isoToMountainTime(initialData.date), // Convert UTC to Mountain Time
        is_recurring: initialData.is_recurring || false,
        recurrence_type: initialData.recurrence_type || "none",
        recurrence_end_date: initialData.recurrence_end_date ? isoToMountainTime(initialData.recurrence_end_date) : "",
      })
      
      if (isCustomType) {
        setIsCustomEventType(true)
        setCustomEventType(initialData.event_type)
      }

      // Load existing secondary organizations from event_organizations
      if (initialData.event_organizations && initialData.event_organizations.length > 0) {
        const orgIds = initialData.event_organizations
          .map(eo => eo.organization_id || eo.organization?.id)
          .filter(id => id !== undefined)
        setSelectedOrganizations(orgIds)
        
        // Debug: Log existing EventOrganization entries
        console.log('📋 [Event Edit Debug] Loading existing EventOrganization entries:')
        initialData.event_organizations.forEach((eo, index) => {
          console.log(`  ${index + 1}. EventOrganization ID: ${eo.id}, Organization: ${eo.organization_name || eo.organization} (ID: ${eo.organization_id || eo.organization?.id})`)
        })
        console.log('Loaded organization IDs:', orgIds)
      } else {
        setSelectedOrganizations([])
        console.log('📋 [Event Edit Debug] No existing EventOrganization entries found')
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

  // Helper function to get end of year in Mountain Time (December 31 at 23:59:59)
  const getEndOfYearInMountainTime = (dateString) => {
    if (!dateString) return ""
    
    // Parse the date string to get the year
    const [datePart] = dateString.split('T')
    const [year] = datePart.split('-').map(Number)
    
    // Create December 31 at 23:59:59 in Mountain Time for that year
    // Format: YYYY-12-31T23:59
    return `${year}-12-31T23:59`
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Automatically set recurrence_end_date to end of year if recurring
    let recurrenceEndDate = ""
    if (eventData.is_recurring && eventData.recurrence_type !== 'none') {
      const endOfYear = getEndOfYearInMountainTime(eventData.date)
      recurrenceEndDate = mountainTimeToISO(endOfYear)
    }

    // Get primary organization ID if it exists
    const primaryOrg = organizations.find(org => (org.name || org) === eventData.organization)
    const primaryOrgId = primaryOrg?.id

    // Filter out primary organization from selected organizations
    const secondaryOrgIds = selectedOrganizations.filter(orgId => orgId !== primaryOrgId)

    // Debug: Log what will be sent to event_organizations table
    console.log('🔍 [Event Creation Debug]')
    console.log('Primary Organization:', eventData.organization, '(ID:', primaryOrgId, ')')
    console.log('Selected Organizations (all):', selectedOrganizations.map(id => {
      const org = organizations.find(o => (o.id || o) === id)
      return { id, name: org?.name || org }
    }))
    console.log('Secondary Organization IDs (filtered):', secondaryOrgIds)
    console.log('Secondary Organizations (names):', secondaryOrgIds.map(id => {
      const org = organizations.find(o => (o.id || o) === id)
      return org?.name || org
    }))
    console.log('Will create EventOrganization entries for:', secondaryOrgIds.length, 'organizations')

    onCreateEvent({
      ...eventData,
      date: mountainTimeToISO(eventData.date),
      recurrence_end_date: recurrenceEndDate,
      organizations: secondaryOrgIds // Send organization IDs, not names
    })
    if (!initialData) {
      setEventData({ 
        organization: "", 
        event_type: "", 
        name: "", 
        description: "", 
        location: "", 
        date: getNextHourInMountainTime(),
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
          disabled={isClubLeader}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org, index) => (
              <SelectItem key={`org-${index}`} value={org.name}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isClubLeader && (
          <p className="text-xs text-gray-500">
            You can only create events for your organization ({user?.admin_profile?.role})
          </p>
        )}
      </div>

      {/* Additional Organizations (Secondary) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Additional Organizations (for cross-club events)</label>
        <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
          {organizations.length === 0 ? (
            <p className="text-sm text-gray-500">Loading organizations...</p>
          ) : (
            <div className="space-y-2">
              {organizations.map((org, index) => {
                const orgId = org.id || org
                const orgName = org.name || org
                const isPrimary = (orgName === eventData.organization)
                const isSelected = selectedOrganizations.includes(orgId)
                const isDisabled = isPrimary || (isClubLeader && orgName === user?.admin_profile?.role)

                return (
                  <div key={`org-${index}`} className="flex items-center space-x-2">
                    <Checkbox
                      id={`org-checkbox-${index}`}
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedOrganizations([...selectedOrganizations, orgId])
                        } else {
                          setSelectedOrganizations(selectedOrganizations.filter(id => id !== orgId))
                        }
                      }}
                      disabled={isDisabled}
                    />
                    <Label 
                      htmlFor={`org-checkbox-${index}`}
                      className={`text-sm font-normal ${isDisabled ? 'text-gray-400 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {orgName} {isPrimary && '(Primary)'}
                    </Label>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {selectedOrganizations.length > 0 && (
          <p className="text-xs text-gray-500">
            Selected: {selectedOrganizations.map(id => {
              const org = organizations.find(o => (o.id || o) === id)
              return org?.name || org
            }).join(', ')}
          </p>
        )}
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
              <p className="text-xs text-gray-500">
                Recurring events will be created until the end of the year ({new Date(eventData.date).getFullYear() || new Date().getFullYear()}).
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