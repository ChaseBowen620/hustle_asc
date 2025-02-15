import { useState, useEffect } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { useToast } from "../../hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { API_URL } from "../../config/api"

function CreateTA({ onSuccess }) {
  const [formData, setFormData] = useState({
    student: "",
    class_assigned: ""
  })
  const [loading, setLoading] = useState(false)
  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studentsRes, classesRes] = await Promise.all([
          axios.get(`${API_URL}/api/students/`),
          axios.get(`${API_URL}/api/classes/`)
        ])
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
    setLoading(true)
    
    console.log('Submitting TA form data:', formData)
    
    try {
      const response = await axios.post(`${API_URL}/api/teaching-assistants/`, formData)
      console.log('Response:', response.data)
      
      toast({
        title: "Success",
        description: "TA position created successfully",
        className: "bg-green-50 border-green-200 text-black",
      })
      
      setFormData({
        student: "",
        class_assigned: ""
      })
      
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error details:', error.response?.data)
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create TA position",
        variant: "destructive",
        className: "bg-red-50 border-red-200 text-black",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Select
          value={formData.student}
          onValueChange={(value) => setFormData(prev => ({
            ...prev,
            student: value
          }))}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Student" />
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
        <Select
          value={formData.class_assigned}
          onValueChange={(value) => setFormData(prev => ({
            ...prev,
            class_assigned: value
          }))}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Class" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((class_) => (
              <SelectItem key={class_.id} value={class_.id.toString()}>
                {class_.course_code} - Prof. {class_.professor.first_name} {class_.professor.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button 
        type="submit" 
        className="w-full"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create TA Position"}
      </Button>
    </form>
  )
}

export default CreateTA 