import { Outlet } from "react-router-dom"

function Layout() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 sm:px-8 py-6 sm:py-8">
        <Outlet />
      </div>
    </main>
  )
}

export default Layout 