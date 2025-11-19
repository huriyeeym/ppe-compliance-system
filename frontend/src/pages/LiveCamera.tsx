import { useState } from 'react'
import LiveVideoStream from '../components/dashboard/LiveVideoStream'

/**
 * Live Camera Sayfası
 * 
 * İnşaat alanı için:
 * - Tam ekran video stream
 * - Person + PPE detection overlay
 * - İhlal anında uyarı
 * - Detection istatistikleri
 */
export default function LiveCamera() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedCamera] = useState<number>(0) // Webcam
  const [selectedDomain] = useState<string>('construction') // İnşaat alanı
  const [detectionStats, setDetectionStats] = useState({
    totalDetections: 0,
    compliant: 0,
    violations: 0,
    hardHatMissing: 0,
    vestMissing: 0,
  })

  const handleViolationDetected = (violation: {
    timestamp?: string
    missing_ppe: string[]
    person_bbox: { x: number; y: number; w: number; h: number }
    confidence?: number
  }) => {
    // İhlal tespit edildiğinde istatistikleri güncelle
    setDetectionStats((prev) => ({
      ...prev,
      violations: prev.violations + 1,
      hardHatMissing: violation.missing_ppe.includes('hard_hat') 
        ? prev.hardHatMissing + 1 
        : prev.hardHatMissing,
      vestMissing: violation.missing_ppe.includes('safety_vest')
        ? prev.vestMissing + 1
        : prev.vestMissing,
    }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title mb-1">Canlı Kamera İzleme</h1>
          <p className="text-caption text-slate-500">
            İnşaat alanı - Gerçek zamanlı PPE tespiti
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`btn-primary ${isStreaming ? 'bg-red-500 hover:bg-red-600' : ''}`}
          >
            {isStreaming ? '⏸️ Durdur' : '▶️ Başlat'}
          </button>
          <button className="btn-secondary">
            ⚙️ Ayarlar
          </button>
        </div>
      </div>

      {/* Video Stream - Tam Ekran */}
      <LiveVideoStream 
        cameraId={selectedCamera}
        isStreaming={isStreaming}
        domainId={selectedDomain}
        onViolationDetected={handleViolationDetected}
      />

      {/* Detection Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-slate-50 mb-1">
            {detectionStats.totalDetections}
          </div>
          <div className="text-caption text-slate-500">Toplam Tespit</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-400 mb-1">
            {detectionStats.compliant}
          </div>
          <div className="text-caption text-slate-500">Uyumlu</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-red-400 mb-1">
            {detectionStats.violations}
          </div>
          <div className="text-caption text-slate-500">İhlal</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            {detectionStats.hardHatMissing + detectionStats.vestMissing}
          </div>
          <div className="text-caption text-slate-500">Eksik PPE</div>
        </div>
      </div>
    </div>
  )
}
