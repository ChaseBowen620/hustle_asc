import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function CheckInStudents({ events, students, onCheckIn }) {
  const [selectedEvent, setSelectedEvent] = useState("")
  const [selectedStudent, setSelectedStudent] = useState("")

  const handleCheckIn = () => {
    if (selectedEvent && selectedStudent) {
      onCheckIn(selectedEvent, selectedStudent)
      setSelectedStudent("")
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Event</label>
        <Select
          value={selectedEvent}
          onValueChange={setSelectedEvent}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select an event" />
          </SelectTrigger>
          <SelectContent>
            {events.map((event) => (
              <SelectItem key={event.id} value={event.id.toString()}>
                {event.name} | {new Date(event.date).toLocaleDateString(undefined, {month: 'long', day: 'numeric'})}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Select Student</label>
        <Select
          value={selectedStudent}
          onValueChange={setSelectedStudent}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a student" />
          </SelectTrigger>
          <SelectContent>
            {students.map((student) => (
              <SelectItem key={student.id} value={student.id.toString()}>
                {student.first_name} {student.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={handleCheckIn}
        disabled={!selectedEvent || !selectedStudent}
        className="w-full"
      >
        Check In Student
      </Button>
    </div>
  )
}

export default CheckInStudents 