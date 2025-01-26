import { useState, useEffect } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function CreateClass({ onSuccess }) {
  const [courseCode, setCourseCode] = useState("")
  const [professorId, setProfessorId] = useState("")
  const [semesterId, setSemesterId] = useState("")
  const [professors, setProfessors] = useState([])
  const [semesters, setSemesters] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [professorsRes, semestersRes] = await Promise.all([
          axios.get('http://localhost:8000/api/professors/'),
          axios.get('http://localhost:8000/api/semesters/')
        ])
        setProfessors(professorsRes.data)
        setSemesters(semestersRes.data)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('http://localhost:8000/api/classes/', {
        course_code: courseCode,
        professor: professorId,
        semester: semesterId
      })
      onSuccess()
    } catch (error) {
      console.error('Error creating class:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Course Code</label>
        <Input
          value={courseCode}
          onChange={(e) => setCourseCode(e.target.value)}
          placeholder="e.g., CS101"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Professor</label>
        <Select value={professorId} onValueChange={setProfessorId}>
          <SelectTrigger>
            <SelectValue placeholder="Select professor" />
          </SelectTrigger>
          <SelectContent>
            {professors.map((professor) => (
              <SelectItem key={professor.id} value={professor.id.toString()}>
                {professor.first_name} {professor.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Semester</label>
        <Select value={semesterId} onValueChange={setSemesterId}>
          <SelectTrigger>
            <SelectValue placeholder="Select semester" />
          </SelectTrigger>
          <SelectContent>
            {semesters.map((semester) => (
              <SelectItem key={semester.id} value={semester.id.toString()}>
                {semester.season} {semester.year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full">Create Class</Button>
    </form>
  )
}

export default CreateClass 