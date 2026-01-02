import { Search, Settings, Download, Calendar, ChevronDown, MapPin, Building2, Check } from 'lucide-react'
import { Listbox, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useDomain } from '../../context/DomainContext'
import NotificationCenter from '../notifications/NotificationCenter'

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
  const navigate = useNavigate()

  return (
    <nav className="bg-white border-b border-[#E9ECEF] h-16 flex items-center px-6 shadow-sm">
      <div className="flex items-center justify-between w-full">
        {/* Left: Domain Selector + Search */}
        <div className="flex items-center gap-4 flex-1">
          {/* Domain Selector */}
          <Listbox value={selectedDomain} onChange={setSelectedDomain} disabled={loading || domains.length === 0}>
            <div className="relative min-w-[180px]">
              <Listbox.Button className="relative w-full pl-10 pr-8 py-2 bg-[#F3F6F9] border border-[#E9ECEF] rounded-lg text-sm text-[#495057] font-medium focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] cursor-pointer text-left">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#878A99]" />
                <span className="block truncate">
                  {loading ? 'Loading...' : domains.length === 0 ? 'No domains' : selectedDomain?.name || 'Select domain'}
                </span>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#878A99]" />
              </Listbox.Button>
              <Transition
                as={Fragment}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-[#E9ECEF] rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                  {domains.map((domain) => (
                    <Listbox.Option
                      key={domain.id}
                      value={domain}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-[#F3F6F9] text-[#405189]' : 'text-[#495057]'
                        }`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate text-sm ${selected ? 'font-medium' : 'font-normal'}`}>
                            {domain.name}
                          </span>
                          {selected && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#405189]">
                              <Check className="w-4 h-4" />
                            </span>
                          )}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>
            </div>
          </Listbox>

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
          <Link
            to="/report"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-[#495057] hover:bg-[#F3F6F9] rounded-md transition-colors"
            title="Go to Report page to export data"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </Link>

          {/* Notifications */}
          <NotificationCenter />

          {/* Settings */}
          <Link
            to="/admin"
            className="p-2 text-[#495057] hover:bg-[#F3F6F9] rounded-md transition-colors"
            title="System Settings & Admin"
          >
            <Settings className="w-5 h-5" />
          </Link>

          {/* User Profile */}
          {user && (
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F3F6F9] rounded-md transition-colors"
              title="System Admin"
            >
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

