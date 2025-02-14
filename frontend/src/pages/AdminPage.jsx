import { useState, useEffect } from "react"
import axios from "axios"
import QuickActions from "../components/admin/QuickActions"
import OverviewCards from "../components/admin/OverviewCards"
import AdminDialogs from "../components/admin/AdminDialogs"
import MainView from "../components/admin/MainView"
import { API_URL } from '../config/api'

function AdminPage() {
  const [activeDialog, setActiveDialog] = useState(null)
  const [tas, setTAs] = useState([])
  const [classes, setClasses] = useState([])
  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState("")
  const [loading, setLoading] = useState(true)
  const [professors, setProfessors] = useState([])

  const fetchTAs = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/teaching-assistants/`)
      
      if (response.data) {
        if (Array.isArray(response.data)) {
          const sortedTAs = response.data.sort((a, b) => 
            a.student.first_name.localeCompare(b.student.first_name)
          )
          setTAs(sortedTAs)
        } else {
          console.error('TA data is not an array:', response.data)
        }
      } else {
        console.error('No data in TA response')
      }
    } catch (error) {
      console.error('Error fetching TAs:', error)
      if (error.response) {
        console.error('Error details:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        })
      }
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch TAs separately
      await fetchTAs()
      
      // Fetch other data
      const [semestersRes, classesRes, professorsRes] = await Promise.all([
        axios.get(`${API_URL}/api/semesters/`),
        axios.get(`${API_URL}/api/classes/`),
        axios.get(`${API_URL}/api/professors/`)
      ])
      
      if (Array.isArray(semestersRes.data)) {
        setSemesters(semestersRes.data)
        const currentSemester = semestersRes.data.find(sem => sem.is_current)
        if (currentSemester) {
          setSelectedSemester(currentSemester.id.toString())
        } else if (semestersRes.data.length > 0) {
          setSelectedSemester(semestersRes.data[0].id.toString())
        }
      }
      
      if (Array.isArray(classesRes.data)) {
        setClasses(classesRes.data)
      }

      if (Array.isArray(professorsRes.data)) {
        setProfessors(professorsRes.data)
      }
    } catch (error) {
      console.error('Error in fetchData:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateSuccess = () => {
    setActiveDialog(null)
    fetchData()
  }

  if (loading) {
    return (
      <div className="text-center">Loading positions...</div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      <QuickActions onActionClick={setActiveDialog} />
      
      <OverviewCards 
        stats={{
          classes: classes,
          tas: tas,
          professors: professors
        }} 
      />

      <MainView 
        semesters={semesters}
        selectedSemester={selectedSemester}
        setSelectedSemester={setSelectedSemester}
        classes={classes}
        tas={tas}
        loading={loading}
      />

      <AdminDialogs 
        activeDialog={activeDialog}
        onClose={() => setActiveDialog(null)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  )
}

export default AdminPage 