import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'

interface Props {
  children: ReactNode
  role?: string | string[]
}

// Helper function to check if user can access admin panel
const canAccessAdmin = (role: string): boolean => {
  return role === 'super_admin' || role === 'admin'
}

export default function RequireAuth({ children, role }: Props) {
  const { user, initialized } = useAuth()

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F6F9]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#405189]"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  // Check role access
  if (role) {
    if (Array.isArray(role)) {
      // Multiple roles allowed
      // super_admin can access any admin/manager pages
      if (user.role === 'super_admin') {
        // super_admin can access admin and manager pages
        if (role.includes('admin') || role.includes('manager')) {
          // Allow access
        } else if (!role.includes(user.role)) {
          return <Navigate to="/" replace />
        }
      } else if (!role.includes(user.role)) {
        return <Navigate to="/" replace />
      }
    } else if (role === 'admin') {
      // Special handling for admin role - allow both super_admin and admin
      if (!canAccessAdmin(user.role)) {
        return <Navigate to="/" replace />
      }
    } else {
      // Single role required
      if (user.role !== role) {
        return <Navigate to="/" replace />
      }
    }
  }

  return <>{children}</>
}

