import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Sidebar() {
  const location = useLocation()
  const activePath = location.pathname
  const { user, logout } = useAuth()

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/live-camera', label: 'Live Camera', icon: '📹' },
    { path: '/report', label: 'Report', icon: '📋' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
    { path: '/configure', label: 'Configure', icon: '⚙️' },
  ]
  if (user?.role === 'admin') {
    menuItems.push({ path: '/admin', label: 'Admin', icon: '👑' })
  }

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
      {/* Logo */}
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1E3A5F] rounded-lg flex items-center justify-center text-white text-lg font-bold">
            🛡️
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900">PPE Monitor</h1>
            <p className="text-xs text-gray-500">v0.2.0</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = activePath === item.path
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm
                    ${
                      isActive
                        ? 'bg-[#1E3A5F] text-white font-medium shadow-sm'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        {user ? (
          <div className="flex flex-col gap-2">
            <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-gray-200">
              <div className="w-8 h-8 bg-[#1E3A5F] rounded-full flex items-center justify-center text-white text-sm font-semibold">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs font-medium text-gray-900">{user.full_name}</p>
                <p className="text-[10px] text-gray-500">{user.role === 'admin' ? 'Admin' : 'Operator'}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="btn-ghost w-full text-xs text-gray-600 hover:text-gray-900"
            >
              Çıkış Yap
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn-primary w-full text-center text-sm">
            Giriş Yap
          </Link>
        )}
      </div>
    </aside>
  )
}

