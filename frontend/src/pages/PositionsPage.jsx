import { useState, useEffect } from "react"
import axios from "axios"
import QuickActions from "../components/admin/QuickActions"
import OverviewCards from "../components/admin/OverviewCards"
import AdminDialogs from "../components/admin/AdminDialogs"
import MainView from "../components/admin/MainView"

function PositionsPage() {
  const [activeDialog, setActiveDialog] = useState(null)
  const [tas, setTAs] = useState([])
  const [classes, setClasses] = useState([])
  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState("")
  const [loading, setLoading] = useState(true)
  const [professors, setProfessors] = useState([])

  const fetchTAs = async () => {
    try {
      console.log('Starting TA fetch...')
      const response = await axios.get('http://localhost:8000/api/teaching-assistants/')
      console.log('TA response status:', response.status)
      console.log('TA response headers:', response.headers)
      console.log('TA raw response:', response)
      
      if (response.data) {
        console.log('TA data received:', response.data)
        if (Array.isArray(response.data)) {
          const sortedTAs = response.data.sort((a, b) => 
            a.student.first_name.localeCompare(b.student.first_name)
          )
          console.log('Setting sorted TAs:', sortedTAs)
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
        axios.get('http://localhost:8000/api/semesters/'),
        axios.get('http://localhost:8000/api/classes/'),
        axios.get('http://localhost:8000/api/professors/')
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
    return <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">Loading positions...</div>
      </div>
    </div>
  }

  return (
    <div className="min-h-screen bg-background px-4 sm:px-8 py-6 sm:py-8">
      <div className="max-w-6xl mx-auto space-y-8">
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
    </div>
  )
}

export default PositionsPage 