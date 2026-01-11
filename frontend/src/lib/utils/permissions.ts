/**
 * Permission utility functions for role-based access control
 */

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer'

/**
 * Page access matrix - defines which roles can access which pages
 */
const PAGE_ACCESS: Record<string, UserRole[]> = {
  dashboard: ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  'system-overview': ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  events: ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  'live-camera': ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  report: ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  analytics: ['super_admin', 'admin', 'manager'],
  configure: ['super_admin', 'admin', 'manager'], // MANAGER gets view-only
  admin: ['super_admin', 'admin'],
}

/**
 * Action permissions - defines which roles can perform which actions
 */
const ACTION_PERMISSIONS: Record<string, UserRole[]> = {
  // Violation actions
  'violations:acknowledge': ['super_admin', 'admin', 'manager', 'operator'],
  'violations:update_status': ['super_admin', 'admin', 'manager'], // Full status update (closed/false_positive)
  'violations:update_notes': ['super_admin', 'admin', 'manager'],
  'violations:delete': ['super_admin', 'admin'],
  
  // Export actions
  'reports:export': ['super_admin', 'admin', 'manager'],
  'analytics:export': ['super_admin', 'admin', 'manager'],
  
  // Domain actions
  'domains:create': ['super_admin', 'admin'],
  'domains:update': ['super_admin', 'admin'],
  'domains:delete': ['super_admin', 'admin'],
  'domains:view': ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  
  // Camera actions
  'cameras:create': ['super_admin', 'admin'],
  'cameras:update': ['super_admin', 'admin'],
  'cameras:delete': ['super_admin', 'admin'],
  'cameras:view': ['super_admin', 'admin', 'manager', 'operator', 'viewer'],
  
  // User actions
  'users:create': ['super_admin', 'admin'],
  'users:update': ['super_admin', 'admin'],
  'users:delete': ['super_admin', 'admin'],
  'users:view': ['super_admin', 'admin'],
  
  // Configuration actions
  'config:update': ['super_admin', 'admin'],
  'config:view': ['super_admin', 'admin', 'manager'],
}

/**
 * Check if a user role can access a specific page
 */
export const canAccessPage = (userRole: UserRole, page: string): boolean => {
  const allowedRoles = PAGE_ACCESS[page]
  if (!allowedRoles) {
    // Unknown page - default to false for safety
    return false
  }
  return allowedRoles.includes(userRole)
}

/**
 * Check if a user role can perform a specific action on a resource
 */
export const canPerformAction = (userRole: UserRole, action: string, resource?: string): boolean => {
  const permissionKey = resource ? `${resource}:${action}` : action
  const allowedRoles = ACTION_PERMISSIONS[permissionKey]
  if (!allowedRoles) {
    // Unknown permission - default to false for safety
    return false
  }
  return allowedRoles.includes(userRole)
}

/**
 * Check if user has any of the specified roles
 */
export const hasRole = (userRole: UserRole, roles: UserRole[]): boolean => {
  return roles.includes(userRole)
}

/**
 * Check if user is admin or super_admin
 */
export const isAdmin = (userRole: UserRole): boolean => {
  return userRole === 'admin' || userRole === 'super_admin'
}

/**
 * Check if user is manager or above
 */
export const isManagerOrAbove = (userRole: UserRole): boolean => {
  return ['super_admin', 'admin', 'manager'].includes(userRole)
}

/**
 * Check if user can view configure page (includes view-only for manager)
 */
export const canViewConfigure = (userRole: UserRole): boolean => {
  return ['super_admin', 'admin', 'manager'].includes(userRole)
}

/**
 * Check if user can edit configure page (only admin, not manager)
 */
export const canEditConfigure = (userRole: UserRole): boolean => {
  return ['super_admin', 'admin'].includes(userRole)
}

