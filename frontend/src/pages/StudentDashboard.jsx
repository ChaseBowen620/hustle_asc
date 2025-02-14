import { useAuth } from "@/hooks/useAuth"

function StudentDashboard() {
  const { user } = useAuth()
  
  return (
    <div className="container mx-auto p-8 text-center">
      <h1 className="text-3xl font-bold mb-4">
        Hello {user?.first_name}, welcome to HUSTLE
      </h1>
      <p className="text-lg text-gray-600">
        Student access is coming soon
      </p>
    </div>
  )
}

export default StudentDashboard 