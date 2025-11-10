import { useState } from 'react'

export default function Report() {
  const [dateRange, setDateRange] = useState({ from: '2025-11-01', to: '2025-11-10' })

  const violations = [
    { id: 1, time: '13:41:53', camera: 'Area 1', type: 'NO-Mask', severity: 'high', image: '👤' },
    { id: 2, time: '13:47:45', camera: 'Area 2', type: 'NO-Hardhat', severity: 'critical', image: '👤' },
    { id: 3, time: '13:51:55', camera: 'Area 1', type: 'NO-Hardhat', severity: 'critical', image: '👤' },
    { id: 4, time: '13:54:55', camera: 'Area 3', type: 'NO-Hardhat, NO-Mask', severity: 'critical', image: '👤' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title mb-1">Violation Reports</h1>
          <p className="text-caption text-slate-500">Detailed compliance reports and analytics</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          📥 Export
        </button>
      </div>

      {/* Filters - Tek satır, sade */}
      <div className="card p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-caption text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-caption text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-caption text-slate-400 mb-1">Camera</label>
            <select className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all">
              <option>All Cameras</option>
              <option>Area 1</option>
              <option>Area 2</option>
              <option>Area 3</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-caption text-slate-400 mb-1">Severity</label>
            <select className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all">
              <option>All</option>
              <option>Critical</option>
              <option>High</option>
              <option>Medium</option>
            </select>
          </div>
          <button className="btn-primary px-6">
            🔍 Filter
          </button>
        </div>
      </div>

      {/* Violations Table - Zebra striping */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Camera</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Image</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {violations.map((violation, index) => (
                <tr 
                  key={violation.id} 
                  className={`
                    hover:bg-slate-700/30 transition-colors
                    ${index % 2 === 0 ? 'bg-slate-800/30' : 'bg-slate-800/10'}
                  `}
                >
                  <td className="px-6 py-4 text-body">{violation.time}</td>
                  <td className="px-6 py-4 text-body">{violation.camera}</td>
                  <td className="px-6 py-4">
                    <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-lg">
                      {violation.image}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-red-500/20 text-red-400 rounded-md text-xs font-medium">
                      {violation.type}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
                      violation.severity === 'critical' 
                        ? 'bg-red-500/20 text-red-400' 
                        : violation.severity === 'high'
                        ? 'bg-orange-500/20 text-orange-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {violation.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="px-4 py-1.5 bg-purple-500/20 text-purple-400 rounded-md text-xs font-medium hover:bg-purple-500/30 transition-all">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

