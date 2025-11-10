import { useState } from 'react'

export default function LiveCamera() {
  const [selectedCamera, setSelectedCamera] = useState(0)

  const cameras = [
    { id: 1, name: 'Area 1 - Main Entrance', status: 'active', fps: 30 },
    { id: 2, name: 'Area 2 - Construction Zone', status: 'active', fps: 28 },
    { id: 3, name: 'Area 3 - Warehouse', status: 'inactive', fps: 0 },
    { id: 4, name: 'Area 4 - Loading Dock', status: 'active', fps: 25 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title mb-1">Live Camera Monitoring</h1>
          <p className="text-caption text-slate-500">Real-time PPE detection across all areas</p>
        </div>
        <div className="flex gap-3">
          <button className="btn-primary">
            📹 Record
          </button>
          <button className="btn-secondary">
            ⚙️ Settings
          </button>
        </div>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {cameras.map((camera, index) => (
          <div
            key={camera.id}
            className={`
              relative rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer
              ${selectedCamera === index 
                ? 'border-purple-500 shadow-lg shadow-purple-500/30' 
                : 'border-slate-700 hover:border-slate-600'
              }
            `}
            onClick={() => setSelectedCamera(index)}
          >
            {/* Camera Feed - Koyu zemin */}
            <div className="aspect-video bg-slate-950 relative">
              {/* Simulated Video Feed */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4 opacity-50">📹</div>
                  <p className="text-slate-400 text-sm">{camera.name}</p>
                </div>
              </div>

              {/* Detection Overlay - Küçük, ince */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border border-green-400 rounded w-24 h-36 flex flex-col items-center justify-center bg-green-500/5">
                  <div className="bg-green-500/80 px-2 py-0.5 rounded text-[10px] font-medium mb-1.5">
                    #1
                  </div>
                  <div className="space-y-0.5">
                    <div className="bg-green-500/80 px-1.5 py-0.5 rounded text-[10px]">
                      ✓ Hat
                    </div>
                    <div className="bg-red-500/80 px-1.5 py-0.5 rounded text-[10px]">
                      ✗ Vest
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-md">
                <div className={`w-1.5 h-1.5 rounded-full ${camera.status === 'active' ? 'bg-green-400' : 'bg-slate-500'}`}></div>
                <span className="text-[10px] font-medium text-slate-200">{camera.status === 'active' ? 'Live' : 'Offline'}</span>
                {camera.status === 'active' && (
                  <span className="text-[10px] text-slate-400">{camera.fps}</span>
                )}
              </div>

              {/* Camera Name */}
              <div className="absolute top-2 right-2 bg-slate-900/90 px-2 py-1 rounded-md">
                <span className="text-[10px] font-medium text-slate-200">{camera.name}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-400 mb-1">3</div>
          <div className="text-caption text-slate-500">Active Cameras</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-slate-50 mb-1">27.7</div>
          <div className="text-caption text-slate-500">Avg FPS</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-yellow-400 mb-1">12</div>
          <div className="text-caption text-slate-500">Detections/min</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-400 mb-1">87%</div>
          <div className="text-caption text-slate-500">Compliance Rate</div>
        </div>
      </div>
    </div>
  )
}

