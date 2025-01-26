import { useState } from "react"
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

function CreateSemester({ onSuccess }) {
  const [season, setSeason] = useState("")
  const [year, setYear] = useState("")
  const [isCurrent, setIsCurrent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await axios.post('http://localhost:8000/api/semesters/', {
        season,
        year: parseInt(year),
        is_current: isCurrent
      })
      onSuccess()
    } catch (error) {
      console.error('Error creating semester:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Season</label>
        <Select value={season} onValueChange={setSeason}>
          <SelectTrigger>
            <SelectValue placeholder="Select season" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FALL">Fall</SelectItem>
            <SelectItem value="SPRING">Spring</SelectItem>
            <SelectItem value="SUMMER">Summer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Year</label>
        <Input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          min="2000"
          max="2100"
          required
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={isCurrent}
          onChange={(e) => setIsCurrent(e.target.checked)}
          className="rounded border-gray-300"
        />
        <label className="text-sm font-medium">Current Semester</label>
      </div>

      <Button type="submit" className="w-full">Create Semester</Button>
    </form>
  )
}

export default CreateSemester 