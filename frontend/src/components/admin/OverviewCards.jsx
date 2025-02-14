import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

function OverviewCards({ stats }) {
  // Filter classes and TAs for current semester only
  const currentSemesterClasses = stats.classes.filter(class_ => 
    class_.semester.is_current
  );

  const currentSemesterTAs = stats.tas.filter(ta => 
    currentSemesterClasses.some(class_ => class_.id === ta.class_assigned.id)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Teaching Assistants</CardTitle>
          <CardDescription>Currently assigned</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{currentSemesterTAs.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Classes</CardTitle>
          <CardDescription>Current semester</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{currentSemesterClasses.length}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Professors</CardTitle>
          <CardDescription>Total registered</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.professors.length}</div>
        </CardContent>
      </Card>
    </div>
  )
}

export default OverviewCards 