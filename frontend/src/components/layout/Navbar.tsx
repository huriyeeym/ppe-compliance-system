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
    <nav className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        {/* Domain Selector - Tab Style */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
          {domains.map((domain) => (
            <button
              key={domain.id}
              onClick={() => setSelectedDomain(domain.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md transition-all duration-200 text-sm font-medium
                ${
                  selectedDomain === domain.id
                    ? 'bg-[#1E3A5F] text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200'
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
          <div className="text-xs text-gray-600">
            {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button className="btn-secondary text-sm">
            📥 Export
          </button>
        </div>
      </div>
    </nav>
  )
}

