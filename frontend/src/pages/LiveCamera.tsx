import { useState, useEffect } from 'react'
import LiveVideoStream from '../components/dashboard/LiveVideoStream'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { violationService } from '../lib/api/services/violationService'
import { logger } from '../lib/utils/logger'

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
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detectionStats, setDetectionStats] = useState({
    totalDetections: 0,
    compliant: 0,
    violations: 0,
    hardHatMissing: 0,
    vestMissing: 0,
  })

  // Domain ve kamera yükle
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const domains = await domainService.getActive()
        const constructionDomain = domains.find(d => d.type === 'construction')
        if (constructionDomain) {
          setSelectedDomain(constructionDomain)
          const cameraList = await cameraService.getAll(constructionDomain.id)
          setCameras(cameraList)
          const activeCamera = cameraList.find(c => c.is_active) || cameraList[0]
          if (activeCamera) {
            setSelectedCamera(activeCamera)
          }
        } else {
          setError('İnşaat alanı bulunamadı')
        }
      } catch (err) {
        logger.error('LiveCamera data load error', err)
        setError('Veriler yüklenemedi')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleViolationDetected = async (violation: {
    timestamp?: string
    missing_ppe: string[]
    person_bbox: { x: number; y: number; w: number; h: number }
    confidence?: number
    frame_snapshot?: string
  }) => {
    if (!selectedDomain || !selectedCamera) return

    // İstatistikleri güncelle
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

    // Database'e kaydet
    try {
      let frameSnapshot = violation.frame_snapshot
      if (frameSnapshot && frameSnapshot.length > 500) {
        frameSnapshot = frameSnapshot.slice(0, 500)
      }

      await violationService.create({
        camera_id: selectedCamera.id,
        domain_id: selectedDomain.id,
        timestamp: violation.timestamp || new Date().toISOString(),
        person_bbox: violation.person_bbox,
        detected_ppe: [],
        missing_ppe: violation.missing_ppe.map(type => ({
          type,
          required: true,
          priority: 1,
        })),
        confidence: violation.confidence || 0.9,
        frame_snapshot: frameSnapshot,
      })
      logger.info('Violation saved to database')
    } catch (err) {
      logger.error('Failed to save violation', err)
    }
  }

  if (loading) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-30 animate-spin">⏳</div>
          <p className="text-body text-slate-500">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (error || !selectedDomain || !selectedCamera) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-30">⚠️</div>
          <h3 className="text-section-title mb-2">Hata</h3>
          <p className="text-body text-slate-500">{error || 'Kamera bulunamadı'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-page-title mb-1">
            {selectedDomain.icon} {selectedDomain.name} - Canlı Kamera
          </h1>
          <p className="text-caption text-slate-500">
            {selectedCamera.name} {selectedCamera.location ? `• ${selectedCamera.location}` : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedCamera.id}
            onChange={(e) => {
              const cameraId = Number(e.target.value)
              const camera = cameras.find(c => c.id === cameraId)
              if (camera) {
                setSelectedCamera(camera)
                setIsStreaming(false)
              }
            }}
            className="px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500"
          >
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`btn-primary ${isStreaming ? 'bg-red-500 hover:bg-red-600' : ''}`}
          >
            {isStreaming ? '⏸️ Durdur' : '▶️ Başlat'}
          </button>
        </div>
      </div>

      {/* Video Stream - Tam Ekran */}
      <LiveVideoStream 
        cameraId={selectedCamera.id}
        isStreaming={isStreaming}
        domainId={selectedDomain.type}
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
