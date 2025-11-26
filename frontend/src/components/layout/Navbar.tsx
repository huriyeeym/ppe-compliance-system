import { Search, Bell, Settings, Download, Calendar, ChevronDown, MapPin } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'

// Helper function to get role display name
const getRoleDisplayName = (role: string): string => {
  const roleMap: Record<string, string> = {
    super_admin: 'Super Admin',
    domain_admin: 'Domain Admin',
    viewer: 'Viewer',
    admin: 'Admin', // Legacy support
    operator: 'Operator', // Legacy support
  }
  return roleMap[role] || role
}

export default function Navbar() {
  const { user } = useAuth()
  const { selectedDomain, domains, setSelectedDomain, loading } = useDomain()

  return (
    <nav className="bg-white border-b border-[#E9ECEF] h-16 flex items-center px-6 shadow-sm">
      <div className="flex items-center justify-between w-full">
        {/* Left: Domain Selector + Search */}
        <div className="flex items-center gap-4 flex-1">
          {/* Domain Selector */}
          <div className="relative">
            <select
              value={selectedDomain?.id || ''}
              onChange={(e) => {
                const domain = domains.find(d => d.id === Number(e.target.value))
                setSelectedDomain(domain || null)
              }}
              disabled={loading || domains.length === 0}
              className="appearance-none pl-10 pr-8 py-2 bg-[#F3F6F9] border border-[#E9ECEF] rounded-md text-sm text-[#495057] font-medium focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] cursor-pointer min-w-[180px]"
            >
              {loading ? (
                <option value="">Loading...</option>
              ) : domains.length === 0 ? (
                <option value="">No domains</option>
              ) : (
                domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.icon} {domain.name}
                  </option>
                ))
              )}
            </select>
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#878A99] pointer-events-none" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#878A99] pointer-events-none" />
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#878A99]" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 bg-[#F3F6F9] border border-[#E9ECEF] rounded-md text-sm text-[#495057] placeholder-[#878A99] focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189]"
            />
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Date Range */}
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#495057] hover:bg-[#F3F6F9] rounded-md transition-colors">
            <Calendar className="w-4 h-4" />
            <span className="text-xs">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </button>

          {/* Export */}
          <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#495057] hover:bg-[#F3F6F9] rounded-md transition-colors">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Notifications */}
          <button className="relative p-2 text-[#495057] hover:bg-[#F3F6F9] rounded-md transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-[#F06548] rounded-full"></span>
          </button>

          {/* Settings */}
          <button className="p-2 text-[#495057] hover:bg-[#F3F6F9] rounded-md transition-colors">
            <Settings className="w-5 h-5" />
          </button>

          {/* User Profile */}
          {user && (
            <button className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F3F6F9] rounded-md transition-colors">
              <div className="w-8 h-8 bg-[#405189] rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-medium text-[#495057]">{user.full_name}</p>
                <p className="text-[10px] text-[#878A99]">{getRoleDisplayName(user.role)}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-[#878A99] hidden md:block" />
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

