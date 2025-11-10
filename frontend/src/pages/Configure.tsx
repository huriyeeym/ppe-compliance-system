import { useState } from 'react'

export default function Configure() {
  const [activeTab, setActiveTab] = useState('domains')

  const tabs = [
    { id: 'domains', label: 'Domains & Rules', icon: '🏗️' },
    { id: 'cameras', label: 'Cameras', icon: '📹' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'model', label: 'ML Model', icon: '🤖' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-page-title mb-1">Configuration</h1>
        <p className="text-caption text-slate-500">Manage domains, cameras, users, and ML models</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-3 text-sm font-medium transition-all relative
              ${activeTab === tab.id
                ? 'text-purple-400 border-b-2 border-purple-500'
                : 'text-slate-400 hover:text-slate-200'
              }
            `}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'domains' && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">Domain Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-dark-700/50 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">🏗️ Construction</h4>
                  <span className="px-2 py-1 bg-success/20 text-success rounded text-xs">Active</span>
                </div>
                <p className="text-sm text-slate-400">3 required PPE types</p>
              </div>
              <div className="p-4 bg-dark-700/50 rounded-lg border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-white">🏭 Manufacturing</h4>
                  <span className="px-2 py-1 bg-success/20 text-success rounded text-xs">Active</span>
                </div>
                <p className="text-sm text-slate-400">5 required PPE types</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-gradient-to-r from-accent-primary to-purple-600 rounded-lg text-white font-medium hover:shadow-lg transition-all">
              + Add Domain
            </button>
          </div>
        )}

        {activeTab === 'cameras' && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">Camera Management</h3>
            <div className="space-y-3">
              {['Area 1', 'Area 2', 'Area 3', 'Area 4'].map((area) => (
                <div key={area} className="flex items-center justify-between p-4 bg-dark-700/50 rounded-lg border border-white/10">
                  <div>
                    <h4 className="font-medium text-white">{area}</h4>
                    <p className="text-sm text-slate-400">rtsp://camera-{area.toLowerCase()}.local</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-accent-primary/20 text-accent-primary rounded text-sm">Edit</button>
                    <button className="px-3 py-1 bg-danger/20 text-danger rounded text-sm">Delete</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="px-4 py-2 bg-gradient-to-r from-accent-primary to-purple-600 rounded-lg text-white font-medium hover:shadow-lg transition-all">
              + Add Camera
            </button>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">User Management</h3>
            <p className="text-slate-400">User management interface coming soon...</p>
          </div>
        )}

        {activeTab === 'model' && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white mb-4">ML Model Configuration</h3>
            <div className="p-4 bg-dark-700/50 rounded-lg border border-white/10">
              <h4 className="font-medium text-white mb-2">Current Model</h4>
              <p className="text-sm text-slate-400">YOLOv8 (Pre-trained)</p>
              <p className="text-sm text-slate-500 mt-1">Custom model training coming soon...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

