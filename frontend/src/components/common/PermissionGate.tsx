import type { ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { hasRole, type UserRole } from '../../lib/utils/permissions'

interface PermissionGateProps {
  /**
   * Roles that are allowed to see the children
   */
  roles: UserRole[]
  /**
   * Optional fallback content to show when user doesn't have permission
   */
  fallback?: ReactNode
  /**
   * If true, renders children but disables them instead of hiding
   */
  disableInsteadOfHide?: boolean
  /**
   * Children to render if user has permission
   */
  children: ReactNode
}

/**
 * PermissionGate component - conditionally renders children based on user role
 * 
 * Usage:
 * <PermissionGate roles={['admin', 'manager']}>
 *   <ExportButton />
 * </PermissionGate>
 */
export default function PermissionGate({
  roles,
  fallback = null,
  disableInsteadOfHide = false,
  children,
}: PermissionGateProps) {
  const { user } = useAuth()

  if (!user) {
    return <>{fallback}</>
  }

  const hasAccess = hasRole(user.role, roles)

  if (!hasAccess) {
    return <>{fallback}</>
  }

  if (disableInsteadOfHide) {
    return (
      <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
        {children}
      </div>
    )
  }

  return <>{children}</>
}

