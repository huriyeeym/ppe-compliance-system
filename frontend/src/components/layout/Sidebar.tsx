import { Link, useLocation } from 'react-router-dom'

export default function Sidebar() {
  const location = useLocation()
  const activePath = location.pathname

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/live-camera', label: 'Live Camera', icon: '📹' },
    { path: '/report', label: 'Report', icon: '📋' },
    { path: '/analytics', label: 'Analytics', icon: '📊' },
    { path: '/configure', label: 'Configure', icon: '⚙️' },
  ]

  return (
    <aside className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Logo - Daha sade, küçük */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-lg">
            🛡️
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-50">PPE Monitor</h1>
            <p className="text-[10px] text-slate-500">v0.2.0</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3">
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
                        ? 'bg-purple-500 text-white font-medium'
                        : 'text-slate-400 hover:bg-slate-700/50 hover:text-slate-200'
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
      <div className="p-3 border-t border-slate-700">
        <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-700/50 transition-all">
          <div className="w-8 h-8 bg-pink-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
            U
          </div>
          <div className="flex-1 text-left">
            <p className="text-xs font-medium text-slate-50">User</p>
            <p className="text-[10px] text-slate-500">Settings</p>
          </div>
        </button>
      </div>
    </aside>
  )
}

