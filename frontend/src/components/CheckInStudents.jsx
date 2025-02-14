import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import axios from "axios"
import { useToast } from "../hooks/use-toast"
import { API_URL } from '../config/api'

function CheckInStudents({ events, students, onCheckIn }) {
  const [selectedEvent, setSelectedEvent] = useState("")
  const [selectedStudent, setSelectedStudent] = useState("")
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    const fetchAttendance = async () => {
      if (selectedEvent) {
        try {
          setLoading(true)
          const response = await axios.get(`${ API_URL }/api/attendance/?event=${selectedEvent}`)
          setAttendance(response.data)
        } catch (error) {
          console.error('Error fetching attendance:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    fetchAttendance()
  }, [selectedEvent])

  const availableStudents = students.filter(student => {
    const isCheckedIn = attendance.some(record => 
      parseInt(record.student) === parseInt(student.id)
    )
    return !isCheckedIn
  })

  const handleCheckIn = async () => {
    if (selectedEvent && selectedStudent) {
      try {
        await onCheckIn(selectedEvent, selectedStudent)
        const student = students.find(s => s.id.toString() === selectedStudent)
        toast({
          title: "Check-in Successful",
          description: `${student.first_name} ${student.last_name} has been checked in.`,
          variant: "success",
          className: "bg-green-50 border-green-200 text-green-800",
        })
        setSelectedStudent("")
        // Refresh attendance data
        const response = await axios.get(`${API_URL}/api/attendance/?event=${selectedEvent}`)
        setAttendance(response.data)
      } catch (error) {
        if (error.response?.data?.error === 'Student already checked in') {
          toast({
            title: "Already Checked In",
            description: "This student has already been checked in for this event.",
            variant: "destructive",
            className: "bg-red-50 border-red-200 text-red-800",
          })
        } else {
          toast({
            title: "Unknown Error",
            description: "An error occurred while checking in. Please try again.",
            variant: "destructive",
            className: "bg-red-50 border-red-200 text-red-800",
          })
        }
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Select Event</label>
        <Select
          value={selectedEvent}
          onValueChange={(value) => {
            setSelectedEvent(value)
            setSelectedStudent("")
          }}
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
          disabled={!selectedEvent || loading}
        >
          <SelectTrigger>
            <SelectValue placeholder={selectedEvent ? "Select a student" : "Select an event first"} />
          </SelectTrigger>
          <SelectContent>
            {availableStudents.length > 0 ? (
              availableStudents.map((student) => (
                <SelectItem key={student.id} value={student.id.toString()}>
                  {student.first_name} {student.last_name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="no-students" disabled>
                {selectedEvent ? "All students checked in" : "Select an event first"}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={handleCheckIn}
        disabled={!selectedEvent || !selectedStudent || loading}
        className="w-full"
      >
        Check In
      </Button>
    </div>
  )
}

export default CheckInStudents 