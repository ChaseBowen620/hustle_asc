import { useState } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function CreateProfessor({ onSuccess }) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await axios.post('http://localhost:8000/api/professors/', formData)
      onSuccess()
    } catch (error) {
      console.error('Error creating professor:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Input
          placeholder="First Name"
          value={formData.first_name}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            first_name: e.target.value
          }))}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Input
          placeholder="Last Name"
          value={formData.last_name}
          onChange={(e) => setFormData(prev => ({
            ...prev,
            last_name: e.target.value
          }))}
          required
        />
      </div>

      <Button 
        type="submit" 
        className="w-full"
        disabled={loading}
      >
        {loading ? "Creating..." : "Create Professor"}
      </Button>
    </form>
  )
}

export default CreateProfessor 