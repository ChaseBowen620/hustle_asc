import { useState, useEffect } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "../../hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { API_URL } from "../../config/api"
function CreateClass({ onSuccess }) {
  const [formData, setFormData] = useState({
    course_code: "",
    professor_id: "",
    semester_id: ""
  })
  const [loading, setLoading] = useState(false)
  const [professors, setProfessors] = useState([])
  const [semesters, setSemesters] = useState([])
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [professorsRes, semestersRes] = await Promise.all([
          axios.get(`${API_URL}/api/professors/`),
          axios.get(`${API_URL}/api/semesters/`)
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
    setLoading(true)
    
    console.log('Submitting form data:', formData)
    
    try {
      const response = await axios.post(`${API_URL}/api/classes/`, formData)
      console.log('Response:', response.data)
      
      toast({
        title: "Success",
        description: "Class created successfully",
        className: "bg-green-50 border-green-200 text-black",
      })
      
      setFormData({
        course_code: "",
        professor_id: "",
        semester_id: ""
      })
      
      if (onSuccess) onSuccess()
    } catch (error) {
      console.error('Error details:', error.response?.data)
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create class",
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
        <Input
          placeholder="Course Code (e.g., CS 101)"
          value={formData.course_code}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            course_code: e.target.value
          }))}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Select
          value={formData.professor_id}
          onValueChange={(value) => setFormData(prev => ({
            ...prev,
            professor_id: value
          }))}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Professor" />
          </SelectTrigger>
          <SelectContent>
            {professors.map((professor) => (
              <SelectItem key={professor.id} value={professor.id.toString()}>
                Prof. {professor.first_name} {professor.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Select
          value={formData.semester_id}
          onValueChange={(value) => setFormData(prev => ({
            ...prev,
            semester_id: value
          }))}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Semester" />
          </SelectTrigger>
          <SelectContent>
            {semesters.map((semester) => (
              <SelectItem key={semester.id} value={semester.id.toString()}>
                {semester.season} {semester.year}
                {semester.is_current ? " (Current)" : ""}
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
        {loading ? "Creating..." : "Create Class"}
      </Button>
    </form>
  )
}

export default CreateClass 