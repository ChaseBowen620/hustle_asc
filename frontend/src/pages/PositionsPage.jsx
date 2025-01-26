import { useState, useEffect } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import CreateClass from "../components/positions/CreateClass"
import CreateTA from "../components/positions/CreateTA"
import { ChevronRight } from "lucide-react"

function PositionsPage() {
  const [view, setView] = useState('main') // 'main' or 'edit'
  const [tas, setTAs] = useState([])
  const [classes, setClasses] = useState([])
  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState("")
  const [loading, setLoading] = useState(true)

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
      const [semestersRes, classesRes] = await Promise.all([
        axios.get('http://localhost:8000/api/semesters/'),
        axios.get('http://localhost:8000/api/classes/')
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
    fetchData()
  }

  if (loading) {
    return <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center">Loading positions...</div>
      </div>
    </div>
  }

  const MainView = () => {
    console.log('MainView rendering with:', {
      semesters,
      selectedSemester,
      classes,
      tas,
      loading
    })

    if (loading) {
      return <div>Loading...</div>
    }

    // Filter classes for selected semester
    const semesterClasses = classes.filter(class_ => {
      const matches = class_.semester.id.toString() === selectedSemester
      return matches
    }).sort((a, b) => a.course_code.localeCompare(b.course_code));

    console.log('Filtered semester classes:', semesterClasses)

    return (
      <>
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Teaching Assistant Positions</h1>
          <Button onClick={() => setView('edit')}>Edit Positions</Button>
        </div>

        <div className="space-y-4 mt-8">
          {semesters.length > 0 ? (
            <Select 
              value={selectedSemester || undefined}
              onValueChange={setSelectedSemester}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select semester" />
              </SelectTrigger>
              <SelectContent>
                {semesters.map((semester) => (
                  <SelectItem 
                    key={semester.id} 
                    value={semester.id.toString()}
                  >
                    {semester.season} {semester.year}
                    {semester.is_current ? " (Current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div>No semesters available</div>
          )}

          <Card>
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {semesterClasses.map((class_) => {
                  const classTAs = tas.filter(ta => 
                    ta.class_assigned.id === class_.id
                  ).sort((a, b) => 
                    a.student.first_name.localeCompare(b.student.first_name)
                  );

                  return (
                    <AccordionItem key={class_.id} value={class_.id.toString()}>
                      <AccordionTrigger className="px-6 hover:no-underline">
                        <div className="flex flex-col items-start">
                          <div className="font-medium">{class_.course_code}</div>
                          <div className="text-sm text-muted-foreground">
                            Prof. {class_.professor.first_name} {class_.professor.last_name}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6">
                        <div className="space-y-2">
                          {classTAs.length > 0 ? (
                            classTAs.map(ta => (
                              <div key={ta.id} className="py-2">
                                {ta.student.first_name} {ta.student.last_name}
                              </div>
                            ))
                          ) : (
                            <div className="py-2 text-muted-foreground">
                              No TAs assigned
                            </div>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </>
    );
  }

  const EditView = () => (
    <>
      <div className="flex items-center space-x-2 mb-6">
        <Button 
          variant="ghost" 
          className="hover:bg-transparent p-0"
          onClick={() => setView('main')}
        >
          Teaching Assistant Positions
        </Button>
        <ChevronRight className="h-4 w-4" />
        <span className="font-semibold">Edit Positions</span>
      </div>

      <Tabs defaultValue="classes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="tas">Teaching Assistants</TabsTrigger>
        </TabsList>

        <TabsContent value="classes">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create New Class</CardTitle>
              </CardHeader>
              <CardContent>
                <CreateClass onSuccess={handleCreateSuccess} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current Classes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {classes.map((class_) => (
                    <div key={class_.id} className="py-4 first:pt-0 last:pb-0">
                      <h3 className="font-medium">{class_.course_code}</h3>
                      <p className="text-sm text-neutral-500">
                        Prof. {class_.professor.first_name} {class_.professor.last_name}
                      </p>
                      <p className="text-sm text-neutral-500">
                        {class_.semester.season} {class_.semester.year}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tas">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Create TA Position</CardTitle>
              </CardHeader>
              <CardContent>
                <CreateTA onSuccess={handleCreateSuccess} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Current TA Positions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y">
                  {tas.map((ta) => (
                    <div key={ta.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium">
                            {ta.student.first_name} {ta.student.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {ta.class_assigned.course_code} - {ta.class_assigned.professor.first_name} {ta.class_assigned.professor.last_name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  )

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {view === 'main' ? <MainView /> : <EditView />}
      </div>
    </div>
  )
}

export default PositionsPage 