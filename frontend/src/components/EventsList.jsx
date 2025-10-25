import { useState } from "react"
import ReactCalendar from "react-calendar"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import CreateEvent from "./CreateEvent"
import 'react-calendar/dist/Calendar.css'

function Calendar({ events, onCreateEvent }) {
  const [selectedDate, setSelectedDate] = useState(new Date())

  // Create a Set of dates that have events (for O(1) lookup)
  const eventDates = new Set(
    events.map(event => format(new Date(event.date), 'yyyy-MM-dd'))
  )

  // Get events for the selected date
  const selectedDateEvents = events.filter(event => 
    format(new Date(event.date), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
  )

  // Custom tile content to show dots for days with events
  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const formattedDate = format(date, 'yyyy-MM-dd')
      if (eventDates.has(formattedDate)) {
        return (
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
            <div className="h-1.5 w-1.5 bg-blue-500 rounded-full"></div>
          </div>
        )
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="calendar-container">
              <ReactCalendar
                value={selectedDate}
                onChange={setSelectedDate}
                tileContent={tileContent}
                className="w-full border-none"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Events for {format(selectedDate, 'MMMM d, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedDateEvents.length > 0 ? (
                selectedDateEvents.map((event) => (
                  <div 
                    key={event.id} 
                    className="p-4 border rounded-lg hover:bg-neutral-50"
                  >
                    <h3 className="font-medium">{event.name}</h3>
                    <p className="text-sm text-neutral-500">
                      {format(new Date(event.date), 'h:mm a')}
                    </p>
                    <p className="text-sm text-neutral-500">{event.location}</p>
                  </div>
                ))
              ) : (
                <p className="text-neutral-500 text-center py-4">
                  No events scheduled for this date
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button className="w-full">Create New Event</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
          </DialogHeader>
          <CreateEvent onCreateEvent={onCreateEvent} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Calendar