import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import CreateClass from "./CreateClass"
import CreateTA from "./CreateTA"
import CreateProfessor from "./CreateProfessor"

function AdminDialogs({ activeDialog, onClose, onSuccess }) {
  return (
    <>
      <Dialog open={activeDialog === "class"} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Class</DialogTitle>
          </DialogHeader>
          <CreateClass onSuccess={onSuccess} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "ta"} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create TA Position</DialogTitle>
          </DialogHeader>
          <CreateTA onSuccess={onSuccess} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeDialog === "professor"} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Professor</DialogTitle>
          </DialogHeader>
          <CreateProfessor onSuccess={onSuccess} />
        </DialogContent>
      </Dialog>
    </>
  )
}

export default AdminDialogs 