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
import { Search, CheckCircle2, UserMinus, ChevronDown, ChevronUp } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import CreateUserForm from "./CreateUserForm"

function getANumber(student) {
  if (student.email && student.email.includes("@")) return student.email.split("@")[0].toUpperCase()
  return (student.username || student.a_number || "").toUpperCase()
}

const MIN_SEARCH_LENGTH = 2

const SEARCH_DROPDOWN_MAX = 8

function CheckInStudents({ students, onCheckIn, attendances, selectedEvent, onUserCreated, useQueue, onNewUserAndCheckIn, onRemoveAttendance, onRemovePendingAttendance, scanMode, hideCheckedInList, hideStudentList }) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [removingId, setRemovingId] = useState(null)
  const [removingTempId, setRemovingTempId] = useState(null)
  const [checkedInExpanded, setCheckedInExpanded] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  const attendedList = (attendances || []).filter(
    (a) => a.student && Number(a.event) === Number(selectedEvent?.id)
  )
  const showAttendedList = !hideCheckedInList && !scanMode && attendedList.length > 0
  const searchLongEnough = (searchTerm || "").trim().length >= MIN_SEARCH_LENGTH
  const showStudentList = !hideStudentList && (!scanMode || searchLongEnough)
  const showSearchDropdown = hideStudentList && searchLongEnough && searchFocused

  const availableStudents = students.filter((student) => {
    return !attendances.some(
      (attendance) =>
        (attendance.student?.id === student.id || attendance.student?.id === student.username) &&
        Number(attendance.event) === Number(selectedEvent?.id)
    )
  })

  const filteredStudents = availableStudents.filter((student) =>
    `${student.first_name || ""} ${student.last_name || ""} ${student.email || ""} ${student.username || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
  )
  const dropdownStudents = hideStudentList ? filteredStudents.slice(0, SEARCH_DROPDOWN_MAX) : []

  const handleConfirmCheckIn = () => {
    onCheckIn(selectedStudent)
    setShowConfirmDialog(false)
    setSelectedStudent(null)
  }

  const handleRemoveAttendance = async (attendanceId) => {
    if (!onRemoveAttendance || !attendanceId) return
    setRemovingId(attendanceId)
    try {
      await onRemoveAttendance(attendanceId)
    } finally {
      setRemovingId(null)
    }
  }

  const handleRemovePendingAttendance = (tempId) => {
    if (!onRemovePendingAttendance || !tempId) return
    setRemovingTempId(tempId)
    try {
      onRemovePendingAttendance(tempId)
    } finally {
      setRemovingTempId(null)
    }
  }

  return (
    <div className="space-y-4">
      {showAttendedList && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCheckedInExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 rounded-lg border border-green-200 bg-green-50/50 px-3 py-2 text-left hover:bg-green-50 transition-colors"
          >
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Checked in ({attendedList.length})
            </h3>
            {checkedInExpanded ? (
              <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
            )}
          </button>
          {checkedInExpanded && (
          <div className="border rounded-lg border-green-200 bg-green-50/50">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Name</TableHead>
                  <TableHead>A-Number</TableHead>
                  {(onRemoveAttendance || onRemovePendingAttendance) && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendedList.map((att) => (
                  <TableRow key={att.id || att.tempId || att.student?.id} className="bg-white/70">
                    <TableCell className="text-green-600">
                      <CheckCircle2 className="h-5 w-5" aria-label="Attended" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {att.student?.first_name} {att.student?.last_name}
                    </TableCell>
                    <TableCell>{getANumber(att.student || {})}</TableCell>
                    {(onRemoveAttendance || onRemovePendingAttendance) && (
                      <TableCell>
                        {att.id ? (
                          onRemoveAttendance && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleRemoveAttendance(att.id)}
                              disabled={removingId === att.id}
                              title="Remove attendance"
                            >
                              {removingId === att.id ? "…" : <UserMinus className="h-4 w-4" />}
                            </Button>
                          )
                        ) : att.tempId && onRemovePendingAttendance ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemovePendingAttendance(att.tempId)}
                            disabled={removingTempId === att.tempId}
                            title="Remove from check-in (pending)"
                          >
                            {removingTempId === att.tempId ? "…" : <UserMinus className="h-4 w-4" />}
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-400">Pending sync</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center space-x-2 flex-1 min-w-0 relative max-w-sm">
          <Search className="w-5 h-5 text-gray-500 shrink-0" />
          <Input
            placeholder={scanMode ? "Search by name or A-number to check in..." : "Search students..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
            className="w-full"
          />
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 z-10 mt-1 border rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto">
              {dropdownStudents.length === 0 ? (
                <div className="px-3 py-4 text-center text-slate-500 text-sm">
                  No students found. Try a different search or create a new user.
                </div>
              ) : (
                dropdownStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-slate-100 active:bg-slate-200 flex justify-between items-center border-b border-slate-100 last:border-0"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setSelectedStudent(student)
                      setShowConfirmDialog(true)
                      setSearchTerm("")
                      setSearchFocused(false)
                    }}
                  >
                    <span className="font-medium truncate">{student.first_name} {student.last_name}</span>
                    <span className="text-slate-500 text-sm shrink-0 ml-2">{getANumber(student)}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <CreateUserForm
          onUserCreated={onUserCreated}
          queueMode={useQueue}
          onQueueSubmit={onNewUserAndCheckIn}
          eventId={selectedEvent?.id}
          eventDate={selectedEvent?.date}
        />
      </div>

      {showStudentList ? (
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
                    {getANumber(student)}
                  </TableCell>
                </TableRow>
              ))}
              {filteredStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-slate-500 py-4">
                    {scanMode && !searchLongEnough
                      ? "Type at least 2 characters to search"
                      : "No students found. Try a different search or create a new user."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        !hideStudentList && scanMode && (
          <p className="text-slate-500 text-sm py-4 text-center">
            Search by name or A-number to check in, or create a new user.
          </p>
        )
      )}

      {hideStudentList && !scanMode && (
        <p className="text-slate-500 text-sm">
          Search by name or A-number above to check in an existing student, or create a new user.
        </p>
      )}

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Check-In</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to check in{" "}
            {selectedStudent?.first_name} {selectedStudent?.last_name} ({getANumber(selectedStudent || {})})?
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
