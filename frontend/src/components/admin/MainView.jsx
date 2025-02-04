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

function MainView({ 
  semesters, 
  selectedSemester, 
  setSelectedSemester, 
  classes, 
  tas, 
  loading 
}) {
  if (loading) {
    return <div>Loading...</div>
  }

  // Filter classes for selected semester
  const semesterClasses = classes.filter(class_ => {
    const matches = class_.semester.id.toString() === selectedSemester
    return matches
  }).sort((a, b) => a.course_code.localeCompare(b.course_code));

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Detail</h2>
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

      <div className="bg-card rounded-lg border">
        <Accordion type="single" collapsible className="w-full">
          {semesterClasses.map((class_) => {
            // Filter TAs for this specific class
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
      </div>
    </div>
  );
}

export default MainView 