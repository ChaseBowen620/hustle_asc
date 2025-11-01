import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, ArrowLeft, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { API_URL } from '@/config/api'

function GeneralCheckInPage() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [closestEvent, setClosestEvent] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchEvents()
  }, [])

  const fetchEvents = async () => {
    try {
      setIsLoading(true)
      const response = await axios.get(`${API_URL}/api/events/`)
      const allEvents = response.data
      
      // Filter for today's events and sort by time
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      
      const todaysEvents = allEvents.filter(event => {
        const eventDate = new Date(event.date)
        return eventDate >= today && eventDate < tomorrow
      }).sort((a, b) => new Date(a.date) - new Date(b.date))
      
      setEvents(todaysEvents)
      
      // Find the closest event (next upcoming event today)
      const now = new Date()
      const upcomingEvents = todaysEvents.filter(event => new Date(event.date) >= now)
      
      if (upcomingEvents.length > 0) {
        setClosestEvent(upcomingEvents[0])
      } else if (todaysEvents.length > 0) {
        // If no upcoming events, use the last event of the day
        setClosestEvent(todaysEvents[todaysEvents.length - 1])
      }
      
    } catch (error) {
      console.error('Error fetching events:', error)
      toast({
        title: "Error",
        description: "Failed to load events. Please try again.",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckInToEvent = () => {
    if (closestEvent) {
      navigate(`/check-in/public/${closestEvent.id}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    )
  }

  if (!closestEvent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">No Events Today</h1>
          <p className="text-gray-600 mb-4">There are no events scheduled for today.</p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Check In</h1>
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-800">{closestEvent.name}</h2>
            <p className="text-gray-600">
              {format(new Date(closestEvent.date), 'EEEE, MMMM d, yyyy')} at {format(new Date(closestEvent.date), 'h:mm a')}
            </p>
            <p className="text-gray-500">{closestEvent.location}</p>
          </div>
        </div>

        {/* Event Selection */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex items-start">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-2">Ready to Check In?</h3>
              <p className="text-gray-600 mb-4">
                We found the closest event for today. Click the button below to check in to this event.
              </p>
              <Button 
                onClick={handleCheckInToEvent}
                className="gap-2"
                size="lg"
              >
                <CheckCircle className="h-5 w-5" />
                Check In to {closestEvent.name}
              </Button>
            </div>
          </div>
        </div>

        {/* All Today's Events */}
        {events.length > 1 && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All Today's Events</h3>
              <p className="text-gray-600 text-sm">Click on any event to check in</p>
            </div>
            <div className="divide-y">
              {events.map((event) => (
                <div 
                  key={event.id}
                  className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/check-in/public/${event.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900">{event.name}</h4>
                      <p className="text-sm text-gray-600">
                        {format(new Date(event.date), 'h:mm a')} • {event.location}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-500">
                        {new Date(event.date) >= new Date() ? 'Upcoming' : 'Past'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GeneralCheckInPage






