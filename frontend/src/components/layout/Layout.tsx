import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()

  if (location.pathname === '/login') {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
        <Navbar />
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

