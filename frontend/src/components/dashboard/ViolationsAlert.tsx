export default function ViolationsAlert() {
  const alerts = [
    { id: 1, type: 'hard hat', icon: '🔨', time: '3:30 PM', area: 'Area 1' },
    { id: 2, type: 'vest', icon: '🦺', time: '12:30 PM', area: 'Area 2' },
    { id: 3, type: 'vest', icon: '🦺', time: '12:45 PM', area: 'Area 1' },
    { id: 4, type: 'hard hat', icon: '🔨', time: '11:30 AM', area: 'Area 3' },
  ]

  const logs = [
    { id: 1, type: 'vest', time: '1:30 PM', area: 'Area 1' },
    { id: 2, type: 'vest', time: '1:10 PM', area: 'Area 2' },
    { id: 3, type: 'vest', time: '1:00 PM', area: 'Area 2' },
    { id: 4, type: 'hard hat', time: '11:30 AM', area: 'Area 1' },
    { id: 5, type: 'vest', time: '10:40 AM', area: 'Area 3' },
    { id: 6, type: 'vest', time: '9:49 AM', area: 'Area 1' },
  ]

  return (
    <div className="space-y-6">
      {/* Violations Alert */}
      <div className="card">
        <h3 className="text-section-title mb-4">Violations Alert</h3>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-xl">
                  {alert.icon}
                </div>
                <div>
                  <p className="text-body font-medium">{alert.type}</p>
                  <p className="text-caption text-slate-500">{alert.time}</p>
                </div>
              </div>
              <button className="btn-ghost text-xs px-3 py-1">
                View
              </button>
            </div>
          ))}
        </div>

        {/* Person ID Filters */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center text-yellow-400 text-sm">
                🔨
              </div>
              <input
                type="text"
                placeholder="Person ID:"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-body placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-400 text-sm">
                😷
              </div>
              <input
                type="text"
                placeholder="Person ID:"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-body placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 text-sm">
                🦺
              </div>
              <input
                type="text"
                placeholder="Person ID:"
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-body placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Violations Log */}
      <div className="card">
        <h3 className="text-section-title mb-4">Violations Log</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-2 hover:bg-slate-900/50 rounded transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-sm">
                  {log.type === 'vest' ? '🦺' : '🔨'}
                </div>
                <div>
                  <p className="text-body">{log.type}</p>
                  <p className="text-caption text-slate-500">{log.area}</p>
                </div>
              </div>
              <p className="text-caption text-slate-500">{log.time}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
