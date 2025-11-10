export default function CameraGrid() {
  const cameras = [
    { id: 1, name: 'Area 1', status: 'active' },
    { id: 2, name: 'Area 2', status: 'active' },
  ]

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-section-title">PPE Live</h3>
        <div className="flex items-center gap-2 text-caption text-slate-500">
          <span>1/10</span>
          <div className="flex gap-1">
            <button className="w-6 h-6 rounded hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200">
              ‹
            </button>
            <button className="w-6 h-6 rounded hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200">
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cameras.map((camera) => (
          <div key={camera.id} className="relative">
            {/* Camera Placeholder - Koyu zemin */}
            <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden relative">
              {/* Simulated Camera Feed */}
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-2 opacity-30">📹</div>
                  <p className="text-slate-500 text-sm">Live Camera Feed</p>
                  <p className="text-slate-600 text-xs mt-1">
                    WebSocket connection pending
                  </p>
                </div>
              </div>

              {/* Camera Label - Küçük */}
              <div className="absolute top-2 left-2 bg-slate-900/90 px-2 py-1 rounded-md">
                <p className="text-[10px] font-medium text-slate-200">{camera.name}</p>
              </div>

              {/* Status Indicator - Küçük */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-slate-900/90 px-2 py-1 rounded-md">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                <span className="text-[10px] text-slate-200">Live</span>
              </div>

              {/* Simulated Detection Box - Küçük, ince */}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
