import { useState } from 'react'

export default function Navbar() {
  const [selectedDomain, setSelectedDomain] = useState('construction')

  const domains = [
    { id: 'construction', name: 'Construction', icon: '🏗️' },
    { id: 'manufacturing', name: 'Manufacturing', icon: '🏭' },
    { id: 'mining', name: 'Mining', icon: '⛏️' },
    { id: 'healthcare', name: 'Healthcare', icon: '🏥' },
  ]

  return (
    <nav className="bg-slate-800 border-b border-slate-700 px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Domain Selector - Tab Style */}
        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg">
          {domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => setSelectedDomain(domain.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm
                ${
                  selectedDomain === domain.id
                    ? 'bg-purple-500 text-white font-medium shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }
              `}
            >
              <span>{domain.icon}</span>
              <span>{domain.name}</span>
            </button>
          ))}
        </div>

        {/* Right Side - Date & Export */}
        <div className="flex items-center gap-4">
          <div className="text-xs text-slate-400">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button className="btn-primary text-sm">
            📥 Export
          </button>
        </div>
      </div>
    </nav>
  )
}

