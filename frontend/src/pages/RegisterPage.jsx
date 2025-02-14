import { Link } from "react-router-dom"
import RegisterForm from "@/components/auth/RegisterForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function RegisterPage() {
  return (
    <div className="bg-background p-4 pt-16 sm:pt-24">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create Account</CardTitle>
        </CardHeader>
        <CardContent>
          <RegisterForm />
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-500 hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegisterPage 