import { useState, useEffect, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { Camera as CameraIcon, Wifi, WifiOff, AlertTriangle, CheckCircle2, Grid3x3, Maximize2, Construction, ShieldAlert, Building2, Factory, Warehouse, Pickaxe, Cross, UtensilsCrossed, Check, ChevronDown, Loader, Play, Pause } from 'lucide-react'
import { Listbox, Transition } from '@headlessui/react'
import KPICard from '../components/dashboard/KPICard'
import LiveVideoStream from '../components/dashboard/LiveVideoStream'
import CameraGrid from '../components/dashboard/CameraGrid'
import ViolationsAlert from '../components/dashboard/ViolationsAlert'
import { useDomain } from '../context/DomainContext'
import { cameraService, type Camera } from '../lib/api/services'
import { violationService, type ViolationStatistics, type ViolationCreatePayload, type Violation } from '../lib/api/services'
import { logger } from '../lib/utils/logger'

/**
 * Construction Site Dashboard
 *
 * Real usage scenario:
 * 1. Domain and camera list fetched from API
 * 2. Statistics fetched from API
 * 3. Live video stream started
 * 4. Violations saved to API when detected
 */

// Helper function to format relative time
function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)

  if (diffSeconds < 30) return 'Just now'
  if (diffSeconds < 60) return '30s ago'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Helper function to get domain icon by type
function getDomainIcon(domainType: string): React.ReactElement {
  const iconMap: Record<string, React.ReactElement> = {
    construction: <Construction className="w-7 h-7 text-[#405189]" />,
    manufacturing: <Factory className="w-7 h-7 text-[#405189]" />,
    warehouse: <Warehouse className="w-7 h-7 text-[#405189]" />,
    mining: <Pickaxe className="w-7 h-7 text-[#405189]" />,
    healthcare: <Cross className="w-7 h-7 text-[#405189]" />,
    food_production: <UtensilsCrossed className="w-7 h-7 text-[#405189]" />,
  }
  return iconMap[domainType] || <Building2 className="w-7 h-7 text-[#405189]" />
}

export default function Dashboard() {
  const { selectedDomain } = useDomain()
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('single')
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [currentTime, setCurrentTime] = useState<Date>(new Date())

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
        logger.error('Camera loading error', err)
        setError('Failed to load camera list')
      }
    }
    loadCameras()
  }, [selectedDomain])

  // Load statistics and recent critical violations
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
        logger.error('Statistics loading error', err)
        setError('Failed to load statistics')
      } finally {
        setLoading(false)
        setLastUpdated(new Date())
      }
    }
    loadData()

    // Refresh every minute
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [selectedDomain])

  // Update current time every 30 seconds for relative time display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  /**
   * Handle detection complete (Smart Recording)
   *
   * This function is called when ML engine completes detection.
   * It only saves violations that backend marks for recording (smart recording strategy).
   */
  const handleDetectionComplete = async (result: {
    detections: Array<{
      person_id: number
      track_id: number | null
      bbox: { x: number; y: number; w: number; h: number }
      ppe_status: {
        hard_hat: { detected: boolean; confidence: number }
        safety_vest: { detected: boolean; confidence: number }
      }
      compliance: boolean
    }>
    violations_recorded: Array<{
      track_id: number
      reason: string
      snapshot_path: string
    }>
    recording_stats: {
      total_recordings: number
      active_sessions: number
      recording_rate: number
    }
    frame_snapshot?: string
  }) => {
    if (!selectedDomain || !selectedCamera) {
      logger.warn('Cannot save violation: domain or camera not selected')
      return
    }

    logger.debug('Detection complete', {
      detections: result.detections.length,
      violations_recorded: result.violations_recorded.length,
      recording_stats: result.recording_stats
    })

    // Only save violations that backend marks for recording
    for (const recordedViolation of result.violations_recorded) {
      try {
        // Find the corresponding detection by track_id
        const detection = result.detections.find(
          d => d.track_id === recordedViolation.track_id
        )

        if (!detection) {
          logger.warn('Could not find detection for recorded violation', recordedViolation)
          continue
        }

        const missing_ppe: string[] = []
        if (!detection.ppe_status.hard_hat.detected) {
          missing_ppe.push('hard_hat')
        }
        if (!detection.ppe_status.safety_vest.detected) {
          missing_ppe.push('safety_vest')
        }

        let frameSnapshot = result.frame_snapshot
        if (frameSnapshot && frameSnapshot.length > 500) {
          frameSnapshot = frameSnapshot.slice(0, 500)
        }

        // Create violation record in database
        const payload: ViolationCreatePayload = {
          camera_id: selectedCamera.id,
          domain_id: selectedDomain.id,
          timestamp: new Date().toISOString(),
          person_bbox: detection.bbox,
          detected_ppe: [],
          missing_ppe: missing_ppe.map(type => ({
            type,
            required: true,
            priority: 1,
          })),
          confidence: Math.max(
            detection.ppe_status.hard_hat.confidence,
            detection.ppe_status.safety_vest.confidence
          ),
          frame_snapshot: frameSnapshot,
        }

        await violationService.create(payload)
        logger.info('Violation saved to database', {
          track_id: recordedViolation.track_id,
          reason: recordedViolation.reason,
          snapshot_path: recordedViolation.snapshot_path
        })
      } catch (err) {
        logger.error('Failed to save violation', err)
      }
    }

    // Refresh statistics after saving all violations
    if (result.violations_recorded.length > 0) {
      try {
        const statsData = await violationService.getStatistics(selectedDomain.id)
        setStats(statsData)
        logger.debug('Statistics refreshed after violations saved')
      } catch (err) {
        logger.error('Failed to refresh statistics', err)
      }
    }
  }

  if (error) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-section-title mb-2 text-gray-900">Error Loading Dashboard</h3>
          <p className="text-body text-gray-700 mb-2">{error}</p>
          <p className="text-caption text-gray-500 mb-6">
            Check if Backend API is running: http://localhost:8000/docs
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!selectedDomain) {
    return (
      <div className="card">
        <div className="text-center py-12">
          <Loader className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-spin" />
          <p className="text-body text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header - Domain and Camera Selection */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              {getDomainIcon(selectedDomain.type)}
              {selectedDomain.name}
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Real-time PPE compliance monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'single'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Single Camera View"
              >
                <Maximize2 className="w-4 h-4" />
                Single
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                  viewMode === 'grid'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Multi-Camera Grid View"
              >
                <Grid3x3 className="w-4 h-4" />
                Grid
              </button>
            </div>

            {/* Start/Stop Button */}
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              disabled={viewMode === 'single' && !selectedCamera}
              className={`flex items-center gap-2 ${isStreaming ? 'btn-danger' : 'btn-primary'} ${viewMode === 'single' && !selectedCamera ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isStreaming ? (
                <>
                  <Pause className="w-4 h-4" />
                  Stop
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start
                </>
              )}
            </button>
          </div>
        </div>

        {/* Camera Selection - Only in single camera mode */}
        {viewMode === 'single' && (
          <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex-1">
              <label className="block text-label mb-1">Camera</label>
              <Listbox value={selectedCamera} onChange={(camera) => {
                setSelectedCamera(camera)
                setIsStreaming(false) // Stop stream when camera changes
              }}>
                <div className="relative">
                  <Listbox.Button className="relative w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-body focus:outline-none focus:border-[#405189] focus:ring-2 focus:ring-[#405189]/20 transition-all text-left cursor-pointer">
                    <span className="block truncate">
                      {selectedCamera ? `${selectedCamera.name} ${selectedCamera.location ? `(${selectedCamera.location})` : ''}` : 'Select camera...'}
                    </span>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </Listbox.Button>
                  <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                  >
                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                      {cameras.map((camera) => (
                        <Listbox.Option
                          key={camera.id}
                          value={camera}
                          className={({ active }) =>
                            `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                              active ? 'bg-[#F3F6F9] text-[#405189]' : 'text-gray-900'
                            }`
                          }
                        >
                          {({ selected }) => (
                            <>
                              <span className={`block truncate text-sm ${selected ? 'font-medium' : 'font-normal'}`}>
                                {camera.name} {camera.location ? `(${camera.location})` : ''}
                              </span>
                              {selected && (
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[#405189]">
                                  <Check className="w-4 h-4" />
                                </span>
                              )}
                            </>
                          )}
                        </Listbox.Option>
                      ))}
                    </Listbox.Options>
                  </Transition>
                </div>
              </Listbox>
            </div>
          </div>
        )}
      </div>

      {/* Last Updated Indicator */}
      {lastUpdated && !loading && (
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-600">
              Last updated: <span className="font-medium text-gray-900">{formatRelativeTime(lastUpdated, currentTime)}</span>
            </span>
          </div>
        </div>
      )}

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
            icon={<Construction className="w-6 h-6" />}
            color="danger"
          />
          <KPICard
            title="Safety Vest Violations"
            value={(stats.by_ppe_type?.safety_vest ?? 0).toLocaleString()}
            icon={<ShieldAlert className="w-6 h-6" />}
            color="danger"
          />
          <KPICard
            title="Compliance Rate"
            value={`${(stats.compliance_rate ?? 0).toFixed(0)}%`}
            icon={<CheckCircle2 className="w-6 h-6" />}
            color="success"
          />
          <KPICard
            title="Total Violations"
            value={(stats.total ?? 0).toLocaleString()}
            icon={<AlertTriangle className="w-6 h-6" />}
            color="warning"
          />
          <KPICard
            title="Active Cameras"
            value={`${cameras.filter(c => c.is_active).length}/${cameras.length}`}
            icon={<CameraIcon className="w-6 h-6" />}
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
              className="text-sm text-[#405189] hover:text-[#364574] font-medium transition-colors"
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
                    className="text-sm text-[#405189] hover:text-[#364574] font-medium transition-colors"
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
      {viewMode === 'grid' ? (
        /* Grid View - Full Width Multi-Camera */
        <div className="grid grid-cols-1 gap-6">
          <CameraGrid
            domainId={selectedDomain.type}
            onDetectionComplete={handleDetectionComplete}
          />
        </div>
      ) : (
        /* Single Camera View - Original Layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sol: Canlı Video Stream */}
          <div className="lg:col-span-2">
            {selectedCamera ? (
              <LiveVideoStream
                cameraId={selectedCamera.id}
                isStreaming={isStreaming}
                domainId={selectedDomain.type}
                onDetectionComplete={handleDetectionComplete}
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

          {/* Right: Violation Alerts */}
          <div className="lg:col-span-1">
            <ViolationsAlert domainId={selectedDomain.type} />
          </div>
        </div>
      )}
    </div>
  )
}
