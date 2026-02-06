import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

// Send datetime-local value as naive MST string with seconds (YYYY-MM-DDTHH:mm:ss)
function toMSTString(datetimeLocal) {
  if (!datetimeLocal) return ""
  return datetimeLocal.length === 16 ? `${datetimeLocal}:00` : datetimeLocal
}

function CreateEvent({ onCreateEvent, initialData }) {
  // Initialize date to next hour in Mountain Time if no initialData
  const [eventData, setEventData] = useState({
    organization: "",
    name: "",
    date: initialData ? "" : getNextHourInMountainTime(),
    is_recurring: false,
    recurrence_type: "none",
    recurrence_end_date: "",
  })
  const [organizations, setOrganizations] = useState([])
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
    if (initialData && organizations.length > 0) {
      setEventData({
        organization: initialData.organization || "",
        name: initialData.name || "",
        date: initialData.date ? String(initialData.date).slice(0, 16) : "",
        is_recurring: initialData.is_recurring || false,
        recurrence_type: initialData.recurrence_type || "none",
        recurrence_end_date: initialData.recurrence_end_date ? String(initialData.recurrence_end_date).slice(0, 16) : "",
      })
      if (initialData.event_organizations && initialData.event_organizations.length > 0) {
        const orgIds = initialData.event_organizations
          .map(eo => eo.organization_id || eo.organization?.id)
          .filter(id => id !== undefined)
        setSelectedOrganizations(orgIds)
      } else {
        setSelectedOrganizations([])
      }
    }
  }, [initialData, organizations])

  const fetchDropdownData = async () => {
    try {
      // Use unauthenticated requests so expired/invalid tokens don't cause 401
      const [organizationsRes] = await Promise.all([
        axios.get(`${API_URL}/api/organizations/`),
      ])
      setOrganizations(organizationsRes.data || [])
      setEventTypes([])
    } catch (error) {
      console.error('Error fetching dropdown data:', error)
    }
  }


  // End of year in MST for recurring events (YYYY-12-31T23:59:00)
  const getEndOfYearMST = (dateString) => {
    if (!dateString) return ""
    const [datePart] = dateString.split('T')
    const [year] = datePart.split('-').map(Number)
    return `${year}-12-31T23:59:00`
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    let recurrenceEndDate = null
    if (eventData.is_recurring && eventData.recurrence_type !== 'none') {
      recurrenceEndDate = getEndOfYearMST(eventData.date)
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
      date: toMSTString(eventData.date),
      recurrence_end_date: recurrenceEndDate,
      organizations: secondaryOrgIds,
      event_type: "",
      description: "",
      location: "",
    })
    if (!initialData) {
      setEventData({ 
        organization: "", 
        name: "", 
        date: getNextHourInMountainTime(),
        is_recurring: false,
        recurrence_type: "none",
        recurrence_end_date: ""
      })
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
        <label className="text-sm font-medium">Event Name</label>
        <Input
          type="text"
          value={eventData.name}
          onChange={(e) => setEventData({ ...eventData, name: e.target.value })}
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