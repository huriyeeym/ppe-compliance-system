interface CameraGridProps {
  domainId?: string
}

interface Camera {
  id: number
  name: string
  domain_id: number
  source_type: 'webcam' | 'rtsp' | 'file'
  source_uri: string
  is_active: boolean
  location?: string
}

export default function CameraGrid({ domainId }: CameraGridProps) {
  // TODO: API call: GET /api/v1/cameras?domain_id=...
  // Şimdilik mock data
  const cameras: Camera[] = [
    { id: 1, name: 'Area 1 - Main Entrance', domain_id: 1, source_type: 'rtsp', source_uri: 'rtsp://camera1.local', is_active: true, location: 'Bina A, Giriş' },
    { id: 2, name: 'Area 2 - Construction Zone', domain_id: 1, source_type: 'webcam', source_uri: '/dev/video0', is_active: true, location: 'Şantiye Alanı' },
  ]

  const filteredCameras = domainId 
    ? cameras.filter(c => c.domain_id.toString() === domainId || c.domain_id === 1) // Mock: domainId string, id number
    : cameras

  const sourceTypeLabels = {
    webcam: 'Webcam',
    rtsp: 'RTSP',
    file: 'Dosya',
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-section-title">Canlı Kamera İzleme</h3>
          <p className="text-caption text-slate-500 mt-1">
            {filteredCameras.length} aktif kamera
          </p>
        </div>
        <div className="flex items-center gap-2 text-caption text-slate-500">
          <span>1/{filteredCameras.length}</span>
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

      {filteredCameras.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/30 rounded-lg border border-slate-700">
          <div className="text-4xl mb-3 opacity-30">📹</div>
          <p className="text-body text-slate-500">Bu domain için kamera bulunamadı</p>
          <p className="text-caption text-slate-600 mt-1">Configure sayfasından kamera ekleyebilirsiniz</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCameras.map((camera) => (
            <div key={camera.id} className="relative">
              {/* Camera Feed - Koyu zemin */}
              <div className="aspect-video bg-slate-950 rounded-lg overflow-hidden relative border border-slate-700">
                {/* Simulated Camera Feed */}
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-2 opacity-30">📹</div>
                    <p className="text-slate-500 text-sm">{camera.name}</p>
                    <p className="text-slate-600 text-xs mt-1">{camera.location}</p>
                  </div>
                </div>

                {/* Camera Info - Üst */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-slate-900/90 px-2 py-1 rounded-md">
                    <div className={`w-1.5 h-1.5 rounded-full ${camera.is_active ? 'bg-green-400' : 'bg-slate-500'}`}></div>
                    <span className="text-[10px] font-medium text-slate-200">
                      {camera.is_active ? 'Live' : 'Offline'}
                    </span>
                    <span className="text-[10px] text-slate-400">•</span>
                    <span className="text-[10px] text-slate-400">{sourceTypeLabels[camera.source_type]}</span>
                  </div>
                  <div className="bg-slate-900/90 px-2 py-1 rounded-md">
                    <span className="text-[10px] font-medium text-slate-200">{camera.name}</span>
                  </div>
                </div>

                {/* Detection Overlay - Küçük, ince */}
                {camera.is_active && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="border border-green-400 rounded w-24 h-36 flex flex-col items-center justify-center bg-green-500/5">
                      <div className="bg-green-500/80 px-2 py-0.5 rounded text-[10px] font-medium mb-1.5">
                        #1
                      </div>
                      <div className="space-y-0.5">
                        <div className="bg-green-500/80 px-1.5 py-0.5 rounded text-[10px]">
                          ✓ Baret
                        </div>
                        <div className="bg-red-500/80 px-1.5 py-0.5 rounded text-[10px]">
                          ✗ Yelek
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
