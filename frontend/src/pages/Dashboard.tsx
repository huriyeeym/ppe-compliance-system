import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Camera as CameraIcon, Wifi, WifiOff, AlertTriangle, CheckCircle2 } from 'lucide-react'
import KPICard from '../components/dashboard/KPICard'
import LiveVideoStream from '../components/dashboard/LiveVideoStream'
import ViolationsAlert from '../components/dashboard/ViolationsAlert'
import { useDomain } from '../context/DomainContext'
import { cameraService, type Camera } from '../lib/api/services'
import { violationService, type ViolationStatistics, type ViolationCreatePayload, type Violation } from '../lib/api/services'
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
  const { selectedDomain } = useDomain()
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
  const [recentCriticalViolations, setRecentCriticalViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // İstatistikleri ve son kritik ihlalleri yükle
  useEffect(() => {
    if (!selectedDomain) return

    const loadData = async () => {
      try {
        setLoading(true)
        logger.debug('Loading violation statistics', { domainId: selectedDomain.id })
        
        // İstatistikler
        const statsData = await violationService.getStatistics(selectedDomain.id)
        setStats(statsData)
        
        // Son kritik ihlaller (son 24 saat)
        const yesterday = new Date()
        yesterday.setHours(yesterday.getHours() - 24)
        const violationsResponse = await violationService.getAll({
          domain_id: selectedDomain.id,
          severity: 'critical',
          start_date: yesterday.toISOString(),
          limit: 5,
        })
        setRecentCriticalViolations(violationsResponse.items)
        
        logger.debug('Statistics and violations loaded', statsData)
      } catch (err) {
        logger.error('İstatistik yükleme hatası', err)
        setError('İstatistikler yüklenemedi')
      } finally {
        setLoading(false)
      }
    }
    loadData()

    // Her 30 saniyede bir yenile
    const interval = setInterval(loadData, 30000)
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
      let frameSnapshot = violation.frame_snapshot
      if (frameSnapshot && frameSnapshot.length > 500) {
        frameSnapshot = frameSnapshot.slice(0, 500)
      }

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
        frame_snapshot: frameSnapshot,
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
          <div className="text-5xl mb-4 text-[#FF6B35]">⚠️</div>
          <h3 className="text-section-title mb-2 text-gray-900">Hata</h3>
          <p className="text-body text-gray-700">{error}</p>
          <p className="text-caption text-gray-500 mt-2">
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
          <div className="text-5xl mb-4 text-gray-400 animate-spin">⏳</div>
          <p className="text-body text-gray-600">Yükleniyor...</p>
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
            <p className="text-caption text-gray-600 mt-1">
              Real-time PPE compliance monitoring
            </p>
          </div>
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            disabled={!selectedCamera}
            className={`${isStreaming ? 'btn-danger' : 'btn-primary'} ${!selectedCamera ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isStreaming ? '⏸️ Stop' : '▶️ Start'}
          </button>
        </div>

        {/* Kamera Seçimi */}
        <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex-1">
            <label className="block text-label mb-1">Camera</label>
            <select
              value={selectedCamera?.id || ''}
              onChange={(e) => {
                const cameraId = Number(e.target.value)
                const camera = cameras.find(c => c.id === cameraId)
                if (camera) {
                  setSelectedCamera(camera)
                  setIsStreaming(false) // Stop stream when camera changes
                }
              }}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-body focus:outline-none focus:border-[#1E3A5F] focus:ring-1 focus:ring-[#1E3A5F] transition-all"
            >
              <option value="">Select camera...</option>
              {cameras.map((camera) => (
                <option key={camera.id} value={camera.id}>
                  {camera.name} {camera.location ? `(${camera.location})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards - API'den gelen veriler */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <KPICard
            title="Hard Hat Violations"
            value={(stats.by_ppe_type?.hard_hat ?? 0).toLocaleString()}
            icon="🔨"
            color="danger"
          />
          <KPICard
            title="Safety Vest Violations"
            value={(stats.by_ppe_type?.safety_vest ?? 0).toLocaleString()}
            icon="🦺"
            color="danger"
          />
          <KPICard
            title="Compliance Rate"
            value={`${(stats.compliance_rate ?? 0).toFixed(0)}%`}
            icon="✅"
            color="success"
          />
          <KPICard
            title="Total Violations"
            value={(stats.total ?? 0).toLocaleString()}
            icon="⚠️"
            color="warning"
          />
          <KPICard
            title="Active Cameras"
            value={`${cameras.filter(c => c.is_active).length}/${cameras.length}`}
            icon="📹"
            color="info"
          />
        </div>
      )}

      {/* Camera Status & Recent Critical Violations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Camera Status */}
        <div className="lg:col-span-1 card">
          <h3 className="text-section-title mb-4 flex items-center gap-2">
            <CameraIcon className="w-5 h-5" />
            Camera Status
          </h3>
          <div className="space-y-3">
            {cameras.length === 0 ? (
              <p className="text-body text-gray-500 text-center py-4">No cameras configured</p>
            ) : (
              cameras.map((camera) => (
                <div
                  key={camera.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    {camera.is_active ? (
                      <Wifi className="w-5 h-5 text-green-600" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-gray-400" />
                    )}
                    <div>
                      <p className="text-body font-medium text-gray-900">{camera.name}</p>
                      {camera.location && (
                        <p className="text-caption text-gray-500">{camera.location}</p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${
                      camera.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {camera.is_active ? 'Online' : 'Offline'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Critical Violations */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-section-title flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Recent Critical Violations (Last 24h)
            </h3>
            <Link
              to="/events"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="space-y-2">
            {recentCriticalViolations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                <p className="text-body">No critical violations in the last 24 hours</p>
              </div>
            ) : (
              recentCriticalViolations.map((violation) => (
                <div
                  key={violation.id}
                  className="flex items-center justify-between p-3 bg-red-50 border-l-4 border-red-500 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="text-body font-medium text-gray-900">
                        Missing: {violation.missing_ppe.map(ppe => 
                          ppe.type === 'hard_hat' ? 'Hard Hat' : 
                          ppe.type === 'safety_vest' ? 'Safety Vest' : 
                          ppe.type
                        ).join(', ')}
                      </p>
                      <p className="text-caption text-gray-600">
                        Camera #{violation.camera_id} • {new Date(violation.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/events`}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View →
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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
                <CameraIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-section-title mb-2 text-gray-900">No Camera Selected</h3>
                <p className="text-body text-gray-600">
                  Please select a camera from the dropdown above
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
