import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/useAuth"
import { API_URL } from '@/config/api'
import axios from "axios"
import { UserPlus } from "lucide-react"

function CreateUserForm({ onUserCreated, queueMode, onQueueSubmit, eventId, eventDate }) {
  const { user } = useAuth()
  const authHeaders = user?.token ? { Authorization: `Bearer ${user.token}` } : {}
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [aNumberExists, setANumberExists] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successUserName, setSuccessUserName] = useState("")
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    a_number: ""
  })
  const { toast } = useToast()

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (name === "a_number") setANumberExists(false)
  }

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      toast({
        title: "Validation Error",
        description: "First name is required",
        variant: "destructive"
      })
      return false
    }
    if (!formData.last_name.trim()) {
      toast({
        title: "Validation Error", 
        description: "Last name is required",
        variant: "destructive"
      })
      return false
    }
    if (!formData.a_number.trim()) {
      toast({
        title: "Validation Error",
        description: "A-number is required", 
        variant: "destructive"
      })
      return false
    }
    // Validate A-number format
    const aNumberPattern = /^a\d{8}$/i
    if (!aNumberPattern.test(formData.a_number.trim())) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid A-number (format: a########)",
        variant: "destructive"
      })
      return false
    }
    if (aNumberExists) {
      toast({
        title: "Validation Error",
        description: "A user with this A-number already exists. Please use a different A-number or search for the existing student to check in.",
        variant: "destructive"
      })
      return false
    }
    return true
  }

  const checkANumberExists = async (value) => {
    const normalized = (value || "").trim().toLowerCase()
    if (!normalized || !/^a\d{8}$/i.test(normalized)) {
      setANumberExists(false)
      return false
    }
    try {
      const res = await fetch(`${API_URL}/api/register/check-a-number/?a_number=${encodeURIComponent(normalized)}`, {
        headers: { ...authHeaders },
      })
      const data = await res.json()
      setANumberExists(!!data.exists)
      return !!data.exists
    } catch {
      setANumberExists(false)
      return false
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const aNum = formData.a_number.trim()
    if (aNum && /^a\d{8}$/i.test(aNum)) {
      const exists = await checkANumberExists(aNum)
      if (exists) {
        toast({
          title: "A-number already in use",
          description: "A user with this A-number already exists. Search for them to check in, or use a different A-number.",
          variant: "destructive"
        })
        return
      }
    }
    if (!validateForm()) {
      return
    }

    if (queueMode && onQueueSubmit && eventId != null) {
      onQueueSubmit({
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        a_number: formData.a_number.trim().toLowerCase()
      })
      setSuccessUserName(`${formData.first_name.trim()} ${formData.last_name.trim()}`)
      setFormData({ first_name: "", last_name: "", a_number: "" })
      setShowSuccessMessage(true)
      if (onUserCreated) onUserCreated()
      return
    }

    setIsLoading(true)
    
    try {
      // Ensure csrftoken cookie exists (same pattern as ScanCheckInPage) before CSRF-protected POST.
      await axios.get(`${API_URL}/api/public/scan/csrf/`, { withCredentials: true }).catch(() => {})
      // Use axios so @/config/axiosAuth attaches X-CSRFToken; register_student requires CSRF for anonymous POST.
      await axios.post(`${API_URL}/api/register/`, formData, {
        headers: { ...authHeaders },
      })

      toast({
        title: "Success",
        description: `User account created successfully for ${formData.first_name} ${formData.last_name}`,
      })

      setFormData({
        first_name: "",
        last_name: "",
        a_number: ""
      })

      setIsOpen(false)

      if (onUserCreated) {
        onUserCreated()
      }
    } catch (error) {
      console.error('Error creating user:', error)
      const msg =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        (error.response?.status === 403
          ? "Request blocked (CSRF). Reload the page and try again, or open the scan/check-in page once to refresh your session."
          : null) ||
        "Network error. Please try again."
      toast({
        title: "Error",
        description: msg,
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      first_name: "",
      last_name: "",
      a_number: ""
    })
    setShowSuccessMessage(false)
    setSuccessUserName("")
    setIsOpen(false)
  }

  const handleCloseAfterSuccess = () => {
    setShowSuccessMessage(false)
    setSuccessUserName("")
    setIsOpen(false)
  }

  const handleOpenChange = (open) => {
    if (!open) {
      setShowSuccessMessage(false)
      setSuccessUserName("")
    }
    setIsOpen(open)
  }

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="gap-2"
        variant="outline"
      >
        <UserPlus className="h-4 w-4" />
        Create New User
      </Button>

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {showSuccessMessage ? "You're all set!" : "Create New User Account"}
            </DialogTitle>
          </DialogHeader>

          {showSuccessMessage ? (
            <div className="space-y-4 py-2">
              <p className="text-slate-700">
                You've created a new account{successUserName ? ` for ${successUserName}` : ""} and your attendance is checked in.
              </p>
              <DialogFooter>
                <Button type="button" onClick={handleCloseAfterSuccess}>
                  OK
                </Button>
              </DialogFooter>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="a_number">A-Number</Label>
              <Input
                id="a_number"
                name="a_number"
                type="text"
                value={formData.a_number}
                onChange={handleInputChange}
                onBlur={() => formData.a_number.trim() && checkANumberExists(formData.a_number)}
                placeholder="a12345678"
                required
                className={aNumberExists ? "border-red-500 focus-visible:ring-red-500" : ""}
              />
              <p className="text-xs text-gray-500">
                Must be a valid A-number (format: a########)
              </p>
              {aNumberExists && (
                <p className="text-xs text-red-600">
                  This A-number is already in the system. Search for the student to check in, or use a different A-number.
                </p>
              )}
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || aNumberExists}
              >
                {isLoading ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CreateUserForm






