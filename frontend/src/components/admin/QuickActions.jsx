import { Button } from "@/components/ui/button"
import { Users, GraduationCap, BookOpen } from "lucide-react"

function QuickActions({ onActionClick }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Button 
        variant="outline"
        className="h-auto py-4 flex flex-col gap-2"
        onClick={() => onActionClick("ta")}
      >
        <Users className="h-5 w-5" />
        <span>Add TA</span>
      </Button>
      <Button 
        variant="outline" 
        className="h-auto py-4 flex flex-col gap-2"
        onClick={() => onActionClick("class")}
      >
        <BookOpen className="h-5 w-5" />
        <span>Add Class</span>
      </Button>
      <Button 
        variant="outline"
        className="h-auto py-4 flex flex-col gap-2"
        onClick={() => onActionClick("professor")}
      >
        <GraduationCap className="h-5 w-5" />
        <span>Add Professor</span>
      </Button>
    </div>
  )
}

export default QuickActions 