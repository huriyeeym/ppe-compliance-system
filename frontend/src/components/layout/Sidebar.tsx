import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { canAccessPage, canViewConfigure, isAdmin, type UserRole } from '../../lib/utils/permissions'
import { 
  LayoutDashboard, 
  Video, 
  FileText, 
  BarChart3, 
  Settings, 
  Shield, 
  LogOut,
  User,
  AlertCircle,
  Globe,
  Users,
  Building2
} from 'lucide-react'

// Helper function to get role display name
const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    manager: 'Manager',
    operator: 'Operator',
    viewer: 'Viewer',
  }
  return roleMap[role] || role
}

export default function Sidebar() {
  const location = useLocation()
  const activePath = location.pathname
  const { user, logout } = useAuth()

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, pageKey: 'dashboard' },
    { path: '/system-overview', label: 'System Overview', icon: Globe, pageKey: 'system-overview' },
    { path: '/events', label: 'Events & Alerts', icon: AlertCircle, pageKey: 'events' },
    { path: '/live-camera', label: 'Live Camera', icon: Video, pageKey: 'live-camera' },
    { path: '/report', label: 'Report', icon: FileText, pageKey: 'report' },
    { path: '/analytics', label: 'Analytics', icon: BarChart3, pageKey: 'analytics' },
    { path: '/configure', label: 'Configuration', icon: Settings, pageKey: 'configure' },
  ]

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter((item) => {
    if (!user) return true // Show items but send to login
    return canAccessPage(user.role as UserRole, item.pageKey)
  })

  // Add admin section - only show to admin/super_admin users
  if (user && isAdmin(user.role as UserRole)) {
    // Add divider before admin section
    filteredMenuItems.push({ path: '', label: '---', icon: Settings, pageKey: 'divider' })
    filteredMenuItems.push({ path: '/users', label: 'User Management', icon: Users, pageKey: 'users' })
    filteredMenuItems.push({ path: '/settings', label: 'System Settings', icon: Settings, pageKey: 'settings' })
    filteredMenuItems.push({ path: '/organization', label: 'Organization Settings', icon: Building2, pageKey: 'organization' })
  }

  return (
    <aside className="w-[280px] bg-[#405189] flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-[#4a5a8a]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: '600', color: '#ffffff' }} className="text-base font-semibold">SafeVision</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {filteredMenuItems.map((item) => {
            // Handle divider
            if (item.pageKey === 'divider') {
              return (
                <li key="divider" className="my-2">
                  <div className="h-px bg-[#4a5a8a]"></div>
                </li>
              )
            }

            const targetPath = !user ? '/sign-in' : item.path
            const isActive = user && activePath === item.path
            const Icon = item.icon
            // Show view-only indicator for Configure page if user is MANAGER
            const showViewOnlyIndicator = item.pageKey === 'configure' && user && canViewConfigure(user.role as UserRole) && !isAdmin(user.role as UserRole)
            return (
              <li key={item.path}>
                <Link
                  to={targetPath}
                  style={{
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                    fontWeight: isActive ? '500' : '400'
                  }}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 text-sm
                    ${
                      isActive
                        ? 'bg-white/10 font-medium'
                        : 'hover:bg-white/5 hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" style={{ color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)' }} />
                  <span style={{ color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)' }} className="flex-1">
                    {item.label}
                  </span>
                  {showViewOnlyIndicator && (
                    <span style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.6)' }} className="text-[10px]">
                      (View)
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[#4a5a8a]">
        {user ? (
          <div className="flex flex-col gap-2">
            <div className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-white/5">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <p style={{ fontSize: '0.75rem', fontWeight: '500', color: '#ffffff' }} className="text-xs font-medium">{user.full_name}</p>
                <p style={{ fontSize: '0.625rem', color: 'rgba(255, 255, 255, 0.7)' }} className="text-[10px]">{getRoleDisplayName(user.role)}</p>
              </div>
            </div>
            <button
              onClick={logout}
              style={{ color: 'rgba(255, 255, 255, 0.8)' }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-white/5 hover:text-white transition-all"
            >
              <LogOut className="w-4 h-4" style={{ color: 'rgba(255, 255, 255, 0.8)' }} />
              <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Logout</span>
            </button>
          </div>
        ) : (
          <Link
            to="/sign-in"
            style={{ color: '#ffffff' }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-white/10 text-sm font-medium hover:bg-white/15 transition-all"
          >
            <User className="w-4 h-4" style={{ color: '#ffffff' }} />
            <span style={{ color: '#ffffff' }}>Sign In</span>
          </Link>
        )}
      </div>
    </aside>
  )
}

