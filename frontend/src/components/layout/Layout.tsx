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
    <div className="flex h-screen overflow-hidden bg-slate-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
        <Navbar />
        <main className="flex-1 overflow-y-auto bg-slate-900">
          <div className="p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

