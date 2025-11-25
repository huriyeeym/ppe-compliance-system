import { useState, useEffect } from 'react'
import KPICard from '../components/dashboard/KPICard'
import LiveVideoStream from '../components/dashboard/LiveVideoStream'
import ViolationsAlert from '../components/dashboard/ViolationsAlert'
import { domainService, type Domain } from '../lib/api/services'
import { cameraService, type Camera } from '../lib/api/services'
import { violationService, type ViolationStatistics, type ViolationCreatePayload } from '../lib/api/services'
import { logger } from '../lib/utils/logger'

/**
 * İnşaat Alanı Dashboard
 * 
 * Gerçek Kullanım Senaryosu:
 * 1. Domain ve kamera listesi API'den çekilir
 * 2. İstatistikler API'den çekilir
 * 3. Canlı video stream başlatılır
 * 4. İhlal tespit edilince API'ye kaydedilir
 */
export default function Dashboard() {
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [stats, setStats] = useState<ViolationStatistics>({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    by_ppe_type: {},
    compliance_rate: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Domain listesini yükle
  useEffect(() => {
    const loadDomains = async () => {
      try {
        logger.info('Loading domains...')
        const domains = await domainService.getActive()
        // İnşaat alanını bul (type: 'construction')
        const constructionDomain = domains.find(d => d.type === 'construction')
        if (constructionDomain) {
          setSelectedDomain(constructionDomain)
          logger.info('Construction domain loaded', { domainId: constructionDomain.id })
        } else {
          logger.warn('Construction domain not found')
          setError('İnşaat alanı bulunamadı')
        }
      } catch (err) {
        logger.error('Domain yükleme hatası', err)
        setError('Domain listesi yüklenemedi')
      }
    }
    loadDomains()
  }, [])

  // Kamera listesini yükle (domain seçildiğinde)
  useEffect(() => {
    if (!selectedDomain) return

    const loadCameras = async () => {
      try {
        logger.info('Loading cameras for domain', { domainId: selectedDomain.id })
        const cameraList = await cameraService.getAll(selectedDomain.id)
        setCameras(cameraList)
        // İlk aktif kamerayı seç
        const activeCamera = cameraList.find(c => c.is_active) || cameraList[0]
        if (activeCamera) {
          setSelectedCamera(activeCamera)
          logger.info('Camera selected', { cameraId: activeCamera.id })
        } else {
          logger.warn('No active camera found')
        }
      } catch (err) {
        logger.error('Kamera yükleme hatası', err)
        setError('Kamera listesi yüklenemedi')
      }
    }
    loadCameras()
  }, [selectedDomain])

  // İstatistikleri yükle
  useEffect(() => {
    if (!selectedDomain) return

    const loadStats = async () => {
      try {
        setLoading(true)
        logger.debug('Loading violation statistics', { domainId: selectedDomain.id })
        const statsData = await violationService.getStatistics(selectedDomain.id)
        setStats(statsData)
        logger.debug('Statistics loaded', statsData)
      } catch (err) {
        logger.error('İstatistik yükleme hatası', err)
        setError('İstatistikler yüklenemedi')
      } finally {
        setLoading(false)
      }
    }
    loadStats()

    // Her 30 saniyede bir yenile
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [selectedDomain])

  /**
   * Handle violation detection
   * 
   * This function is called when the ML engine detects a violation.
   * It saves the violation to the database and updates statistics.
   */
  const handleViolationDetected = async (violation: {
    timestamp?: string
    person_bbox: { x: number; y: number; w: number; h: number }
    detected_ppe?: Array<{ type: string; confidence: number }>
    missing_ppe: string[]
    confidence?: number
    frame_snapshot?: string
  }) => {
    if (!selectedDomain || !selectedCamera) {
      logger.warn('Cannot save violation: domain or camera not selected')
      return
    }

    try {
      logger.info('Violation detected, saving to database', {
        cameraId: selectedCamera.id,
        domainId: selectedDomain.id,
        missingPPE: violation.missing_ppe,
      })

      // Prepare violation payload
      const payload: ViolationCreatePayload = {
        camera_id: selectedCamera.id,
        domain_id: selectedDomain.id,
        timestamp: violation.timestamp || new Date().toISOString(),
        person_bbox: violation.person_bbox,
        detected_ppe: violation.detected_ppe || [],
        missing_ppe: violation.missing_ppe.map((type: string) => ({
          type,
          required: true, // İnşaat alanında baret ve yelek zorunlu
          priority: 1, // Critical priority
        })),
        confidence: violation.confidence || 0.9,
        frame_snapshot: violation.frame_snapshot,
      }

      // Save to database
      const savedViolation = await violationService.create(payload)
      logger.info('Violation saved successfully', { violationId: savedViolation.id })

      // Refresh statistics
      const statsData = await violationService.getStatistics(selectedDomain.id)
      setStats(statsData)
      logger.debug('Statistics refreshed after violation save')
    } catch (err) {
      logger.error('İhlal kaydetme hatası', err)
      // TODO: Show user-friendly error notification
    }
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-30">⚠️</div>
          <h3 className="text-section-title mb-2">Hata</h3>
          <p className="text-body text-slate-500">{error}</p>
          <p className="text-caption text-slate-600 mt-2">
            Backend API çalışıyor mu kontrol edin: http://localhost:8000/docs
          </p>
        </div>
      </div>
    )
  }

  if (!selectedDomain) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <div className="text-4xl mb-4 opacity-30 animate-spin">⏳</div>
          <p className="text-body text-slate-500">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header - Domain ve Kamera Seçimi */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-page-title">
              {selectedDomain.icon} {selectedDomain.name}
            </h1>
            <p className="text-caption text-slate-500 mt-1">
              Gerçek zamanlı baret ve yelek tespiti
            </p>
          </div>
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            disabled={!selectedCamera}
            className={`btn-primary ${isStreaming ? 'bg-red-500 hover:bg-red-600' : ''} ${!selectedCamera ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isStreaming ? '⏸️ Durdur' : '▶️ Başlat'}
          </button>
        </div>

        {/* Kamera Seçimi */}
        <div className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex-1">
            <label className="block text-caption text-slate-400 mb-1">Kamera</label>
            <select
              value={selectedCamera?.id || ''}
              onChange={(e) => {
                const cameraId = Number(e.target.value)
                const camera = cameras.find(c => c.id === cameraId)
                if (camera) {
                  setSelectedCamera(camera)
                  setIsStreaming(false) // Kamera değişince stream'i durdur
                }
              }}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body focus:outline-none focus:border-purple-500 transition-all"
            >
              <option value="">Kamera seçin...</option>
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name} {camera.location ? `(${camera.location})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-caption text-slate-400 mb-1">Domain</label>
            <div className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-body">
              {selectedDomain.icon} {selectedDomain.name}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards - API'den gelen veriler */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-24 bg-slate-700 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Baret İhlali"
            value={(stats.by_ppe_type?.hard_hat ?? 0).toLocaleString()}
            icon="🔨"
            color="danger"
          />
          <KPICard
            title="Yelek İhlali"
            value={(stats.by_ppe_type?.safety_vest ?? 0).toLocaleString()}
            icon="🦺"
            color="danger"
          />
          <KPICard
            title="Uyumluluk Oranı"
            value={`${(stats.compliance_rate ?? 0).toFixed(0)}%`}
            icon="✅"
            color="success"
          />
          <KPICard
            title="Toplam İhlal"
            value={(stats.total ?? 0).toLocaleString()}
            icon="⚠️"
            color="warning"
          />
        </div>
      )}

      {/* Main Content - Canlı Video + İhlaller */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Canlı Video Stream */}
        <div className="lg:col-span-2">
          {selectedCamera ? (
            <LiveVideoStream 
              cameraId={selectedCamera.id}
              isStreaming={isStreaming}
              domainId={selectedDomain.type}
              onViolationDetected={handleViolationDetected}
            />
          ) : (
            <div className="card">
              <div className="text-center py-12">
                <div className="text-6xl mb-4 opacity-30">📹</div>
                <h3 className="text-section-title mb-2">Kamera Seçilmedi</h3>
                <p className="text-body text-slate-500">
                  Lütfen yukarıdan bir kamera seçin
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sağ: İhlal Uyarıları */}
        <div className="lg:col-span-1">
          <ViolationsAlert domainId={selectedDomain.type} />
        </div>
      </div>
    </>
  )
}
