import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  // Don't show sidebar/navbar for auth pages
  if (location.pathname === '/sign-in' || location.pathname === '/signup' || location.pathname === '/forgot-password') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F3F6F9]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F3F6F9]">
        <Navbar />
        <main className="flex-1 overflow-y-auto bg-[#F3F6F9]">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}

