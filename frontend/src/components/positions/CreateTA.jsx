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

function CreateTA({ onSuccess }) {
  const [studentId, setStudentId] = useState("")
  const [classId, setClassId] = useState("")
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, classesRes] = await Promise.all([
          axios.get('http://localhost:8000/api/students/'),
          axios.get('http://localhost:8000/api/classes/')
        ])
        console.log('Students:', studentsRes.data)
        console.log('Classes:', classesRes.data)
        setStudents(studentsRes.data)
        setClasses(classesRes.data)
      } catch (error) {
        console.error('Error fetching data:', error)
      }
    }
    fetchData()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('Submitting TA:', {
        student: studentId,
        class_assigned: classId
    })
    try {
        await axios.post('http://localhost:8000/api/teaching-assistants/', {
            student: studentId,
            class_assigned: classId
        })
        onSuccess()
    } catch (error) {
        console.error('Error response:', error.response?.data)
        console.error('Error creating TA position:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Student</label>
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select student" />
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

      <div className="space-y-2">
        <label className="text-sm font-medium">Class</label>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger>
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((class_) => (
              <SelectItem key={class_.id} value={class_.id.toString()}>
                {class_.course_code} - {class_.professor.first_name} {class_.professor.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button type="submit" className="w-full bg-slate-800 hover:bg-slate-700">
        Create TA Position
      </Button>
    </form>
  )
}

export default CreateTA 