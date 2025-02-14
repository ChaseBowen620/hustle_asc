import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

function CheckInStudents({ students, onCheckIn, attendances, selectedEvent }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  // Filter out students who have already checked in to this event
  const availableStudents = students.filter(student => {
    return !attendances.some(
      attendance => 
        attendance.student.id === student.id && 
        attendance.event === selectedEvent.id
    )
  })

  const filteredStudents = availableStudents.filter(student =>
    `${student.first_name} ${student.last_name} ${student.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleConfirmCheckIn = () => {
    onCheckIn(selectedStudent)
    setShowConfirmDialog(false)
    setSelectedStudent(null)
  }

  // Extract A-Number from email (assumes format: a12345678@usu.edu)
  const getANumber = (email) => {
    return email.split('@')[0].toUpperCase()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Search className="w-5 h-5 text-gray-500" />
        <Input
          placeholder="Search students..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>A-Number</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map((student) => (
              <TableRow 
                key={student.id}
                onClick={() => {
                  setSelectedStudent(student)
                  setShowConfirmDialog(true)
                }}
                className="cursor-pointer hover:bg-slate-100 active:bg-slate-200 transition-colors group"
              >
                <TableCell className="font-medium group-hover:text-slate-900">
                  {student.first_name} {student.last_name}
                </TableCell>
                <TableCell className="group-hover:text-slate-900">
                  {getANumber(student.email)}
                </TableCell>
              </TableRow>
            ))}
            {filteredStudents.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-slate-500 py-4">
                  No students available for check-in
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Check-In</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to check in{" "}
            {selectedStudent?.first_name} {selectedStudent?.last_name} ({getANumber(selectedStudent?.email || "")})?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCheckIn}>
              Confirm Check-In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CheckInStudents
