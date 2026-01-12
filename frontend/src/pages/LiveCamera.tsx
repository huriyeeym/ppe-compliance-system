import { useState, useEffect, useCallback, useMemo } from 'react'
import { Volume2, VolumeX, Play, Pause, Construction, Factory, Warehouse, Pickaxe, Cross, UtensilsCrossed, Building2, XCircle, Webcam, Grid3x3, Grid2x2, List, LayoutGrid, Search } from 'lucide-react'
import LiveVideoStream from '../components/dashboard/LiveVideoStream'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { useAuth } from '../context/AuthContext'
import { logger } from '../lib/utils/logger'
import { showViolationAlert, showSuccessAlert } from '../components/alerts/ViolationAlert'
import { audioAlert } from '../lib/utils/audioAlert'
import MultiSelect from '../components/common/MultiSelect'

// Helper function to get domain icon by type
function getDomainIcon(domainType: string): React.ReactElement {
  const iconMap: Record<string, React.ReactElement> = {
    construction: <Construction className="w-6 h-6 text-[#405189]" />,
    manufacturing: <Factory className="w-6 h-6 text-[#405189]" />,
    warehouse: <Warehouse className="w-6 h-6 text-[#405189]" />,
    mining: <Pickaxe className="w-6 h-6 text-[#405189]" />,
    healthcare: <Cross className="w-6 h-6 text-[#405189]" />,
    food_production: <UtensilsCrossed className="w-6 h-6 text-[#405189]" />,
  }
  return iconMap[domainType] || <Building2 className="w-6 h-6 text-[#405189]" />
}

interface CameraStreamState {
  camera: Camera
  domain: Domain
  isStreaming: boolean
  detectionStats: {
    totalDetections: number
    compliant: number
    violations: number
    hardHatMissing: number
    vestMissing: number
    uniquePersonIds: number[]
  }
}

type GridLayout = '1x1' | '2x2' | '3x3' | '4x4'
type ViewMode = 'grid' | 'list'

/**
 * Live Camera Page - Multi-Camera View
 *
 * Professional redesign with:
 * - Organization-based domain/camera loading
 * - Multi-select domain dropdown
 * - Show all cameras, filter by selected domains
 * - Grid and list view options
 * - Start All Visible functionality
 */
export default function LiveCamera() {
  const { user } = useAuth()
  const [selectedDomainIds, setSelectedDomainIds] = useState<number[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [cameraStreams, setCameraStreams] = useState<Map<number, CameraStreamState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [gridLayout, setGridLayout] = useState<GridLayout>('2x2')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Load domains and cameras based on user's organization
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Load organization domains (same as Report/Events pages)
        let domainsList: Domain[] = []
        if (user.organization_id) {
          domainsList = await domainService.getOrganizationDomains(user.organization_id)
          logger.info(`LiveCamera: Loaded ${domainsList.length} organization domains`, {
            organization_id: user.organization_id,
            domains: domainsList.map(d => ({ id: d.id, name: d.name, type: d.type }))
          })
        } else {
          // Fallback: Load active domains
          domainsList = await domainService.getActive()
        }
        setDomains(domainsList)

        // Load all cameras from organization domains
        const allCameras: Camera[] = []
        for (const domain of domainsList) {
          try {
            const domainCameras = await cameraService.getAll(domain.id)
            allCameras.push(...domainCameras.filter(c => c.is_active))
          } catch (err) {
            logger.error(`Failed to load cameras for domain ${domain.id}`, err)
          }
        }
        setCameras(allCameras)

        // Auto-select all domains by default
        if (selectedDomainIds.length === 0 && domainsList.length > 0) {
          setSelectedDomainIds(domainsList.map(d => d.id))
        }
      } catch (err) {
        logger.error('LiveCamera data load error', err)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user, user?.organization_id])

  // Filter cameras based on selected domains and search query
  const filteredCameras = useMemo(() => {
    let filtered = cameras

    // Filter by domain
    if (selectedDomainIds.length > 0) {
      filtered = filtered.filter(c => selectedDomainIds.includes(c.domain_id))
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.location?.toLowerCase().includes(query) ||
        domains.find(d => d.id === c.domain_id)?.name.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [cameras, selectedDomainIds, searchQuery, domains])

  // Initialize camera streams for filtered cameras
  useEffect(() => {
    const newStreams = new Map<number, CameraStreamState>()
    
    filteredCameras.forEach(camera => {
      const domain = domains.find(d => d.id === camera.domain_id)
      if (domain) {
        // Keep existing state if camera already exists, otherwise create new
        const existing = cameraStreams.get(camera.id)
        newStreams.set(camera.id, existing || {
          camera,
          domain,
          isStreaming: false,
          detectionStats: {
            totalDetections: 0,
            compliant: 0,
            violations: 0,
            hardHatMissing: 0,
            vestMissing: 0,
            uniquePersonIds: []
          }
        })
      }
    })

    // Remove streams for cameras that are no longer in filtered list
    cameraStreams.forEach((state, cameraId) => {
      if (!filteredCameras.find(c => c.id === cameraId)) {
        // Stream will be stopped by LiveVideoStream component cleanup
      } else {
        // Keep existing stream state
        if (!newStreams.has(cameraId)) {
          newStreams.set(cameraId, state)
        }
      }
    })

    setCameraStreams(newStreams)
  }, [filteredCameras, domains])

  const handleDetectionComplete = useCallback((cameraId: number) => async (result: {
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
    const streamState = cameraStreams.get(cameraId)
    if (!streamState) {
      logger.warn(`No stream state found for camera ${cameraId}`)
      return
    }

    logger.debug('Detection complete', {
      cameraId,
      detections: result.detections.length,
      violations_recorded: result.violations_recorded.length,
      recording_stats: result.recording_stats
    })

    // Update stats for this camera
    const newViolations = result.violations_recorded.length
    const uniquePersons = new Set(
      result.detections
        .filter(d => d.track_id !== null && d.track_id !== undefined)
        .map(d => d.track_id)
    )

    setCameraStreams(prev => {
      const updated = new Map(prev)
      const current = updated.get(cameraId)
      if (!current) return prev

      const currentUniquePersons = new Set(current.detectionStats.uniquePersonIds || [])
      uniquePersons.forEach(id => {
        if (id !== null && id !== undefined) {
          currentUniquePersons.add(id)
        }
      })

      const violationDetections = result.detections.filter(d => !d.compliance)

      updated.set(cameraId, {
        ...current,
        detectionStats: {
          ...current.detectionStats,
          violations: current.detectionStats.violations + newViolations,
          totalDetections: currentUniquePersons.size,
          hardHatMissing: current.detectionStats.hardHatMissing + violationDetections.filter(
            d => !d.ppe_status.hard_hat.detected
          ).length,
          vestMissing: current.detectionStats.vestMissing + violationDetections.filter(
            d => !d.ppe_status.safety_vest.detected
          ).length,
          uniquePersonIds: Array.from(currentUniquePersons)
        }
      })

      return updated
    })

    // Show violation alerts
    for (const recordedViolation of result.violations_recorded) {
      try {
        const detection = result.detections.find(
          d => d.track_id === recordedViolation.track_id
        )

        if (!detection) {
          logger.warn('Could not find detection for recorded violation', recordedViolation)
          continue
        }

        const missing_ppe: string[] = []
        const missing_ppe_labels: string[] = []
        if (!detection.ppe_status.hard_hat.detected) {
          missing_ppe.push('hard_hat')
          missing_ppe_labels.push('Hard Hat')
        }
        if (!detection.ppe_status.safety_vest.detected) {
          missing_ppe.push('safety_vest')
          missing_ppe_labels.push('Safety Vest')
        }

        const severity: 'low' | 'medium' | 'high' | 'critical' =
          missing_ppe.length >= 2 ? 'critical' :
          missing_ppe.length === 1 && missing_ppe.includes('hard_hat') ? 'high' : 'medium'

        showViolationAlert({
          track_id: recordedViolation.track_id,
          reason: `${streamState.camera.name} - ${recordedViolation.reason}`,
          missing_ppe: missing_ppe_labels,
          severity,
          timestamp: new Date().toISOString(),
        })

        logger.info('Violation recorded by backend', {
          cameraId,
          track_id: recordedViolation.track_id,
          reason: recordedViolation.reason,
          snapshot_path: recordedViolation.snapshot_path
        })
      } catch (err) {
        logger.error('Failed to process violation', err)
      }
    }
  }, [cameraStreams])

  const toggleCameraStream = (cameraId: number) => {
    setCameraStreams(prev => {
      const updated = new Map(prev)
      const current = updated.get(cameraId)
      if (current) {
        updated.set(cameraId, {
          ...current,
          isStreaming: !current.isStreaming
        })
      }
      return updated
    })
  }

  // Start/Stop all VISIBLE cameras only
  const toggleAllVisibleStreams = () => {
    const visibleStreams = Array.from(cameraStreams.values())
    const allStreaming = visibleStreams.length > 0 && visibleStreams.every(s => s.isStreaming)
    
    setCameraStreams(prev => {
      const updated = new Map(prev)
      visibleStreams.forEach((state) => {
        updated.set(state.camera.id, {
          ...state,
          isStreaming: !allStreaming
        })
      })
      return updated
    })
  }

  const getGridCols = () => {
    switch (gridLayout) {
      case '1x1': return 'grid-cols-1'
      case '2x2': return 'grid-cols-2'
      case '3x3': return 'grid-cols-3'
      case '4x4': return 'grid-cols-4'
      default: return 'grid-cols-2'
    }
  }

  const visibleCameras = Array.from(cameraStreams.values())
  const allStreaming = visibleCameras.length > 0 && visibleCameras.every(s => s.isStreaming)

  const totalStats = visibleCameras.reduce((acc, stream) => {
    return {
      totalDetections: acc.totalDetections + stream.detectionStats.totalDetections,
      compliant: acc.compliant + stream.detectionStats.compliant,
      violations: acc.violations + stream.detectionStats.violations,
      hardHatMissing: acc.hardHatMissing + stream.detectionStats.hardHatMissing,
      vestMissing: acc.vestMissing + stream.detectionStats.vestMissing,
    }
  }, { totalDetections: 0, compliant: 0, violations: 0, hardHatMissing: 0, vestMissing: 0 })

  if (loading) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#405189] mx-auto mb-4"></div>
            <p className="text-body text-gray-500">Loading cameras...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || domains.length === 0) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-section-title mb-2">
              {error ? 'Error' : 'No Domains Found'}
            </h3>
            <p className="text-body text-gray-500 mb-4">
              {error || 'No active domains found. Please create a domain first.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const domainOptions = domains.map(d => ({
    value: d.id,
    label: d.name
  }))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-page-title flex items-center gap-2">
              <Webcam className="w-7 h-7 text-[#405189]" />
              Live Camera Monitoring
            </h1>
            <p className="text-caption text-gray-600 mt-1">
              Real-time video streams with PPE detection
              {visibleCameras.length > 0 && (
                <> - {visibleCameras.length} camera{visibleCameras.length !== 1 ? 's' : ''} visible</>
              )}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => {
                const newMuted = audioAlert.toggleMute()
                setIsMuted(newMuted)
                showSuccessAlert(newMuted ? 'Audio alerts disabled' : 'Audio alerts enabled')
              }}
              className="btn-secondary flex items-center gap-2"
              title={isMuted ? 'Enable Sound' : 'Disable Sound'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span className="hidden sm:inline">{isMuted ? 'Off' : 'On'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unified Control Panel */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cameras..."
                className="w-full h-10 pl-10 pr-3 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#405189]/20 focus:border-[#405189] transition-all"
              />
            </div>
          </div>

          {/* Domain Filter */}
          <div className="flex-shrink-0" style={{ width: '400px' }}>
            <MultiSelect
              value={selectedDomainIds}
              onChange={(values) => setSelectedDomainIds(values as number[])}
              options={domainOptions}
              placeholder="Filter by Domain"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex gap-0 border border-gray-300 rounded-lg overflow-hidden h-10 flex-shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-4 h-10 flex items-center gap-2 text-sm font-medium transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#405189] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 h-10 flex items-center gap-2 text-sm font-medium transition-colors border-l border-gray-300 ${
                viewMode === 'list'
                  ? 'bg-[#405189] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
              title="List View"
            >
              <List className="h-4 w-4" />
              <span>List</span>
            </button>
          </div>

          {/* Grid Layout (only in grid view) */}
          {viewMode === 'grid' && (
            <div className="flex gap-0 border border-gray-300 rounded-lg overflow-hidden h-10 flex-shrink-0">
                <button
                  onClick={() => setGridLayout('1x1')}
                  className={`px-3 h-10 flex items-center justify-center transition-colors ${
                    gridLayout === '1x1' ? 'bg-[#405189] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="1 Column"
                >
                  <Grid2x2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setGridLayout('2x2')}
                  className={`px-3 h-10 flex items-center justify-center transition-colors border-l border-gray-300 ${
                    gridLayout === '2x2' ? 'bg-[#405189] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="2 Columns"
                >
                  <Grid2x2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setGridLayout('3x3')}
                  className={`px-3 h-10 flex items-center justify-center transition-colors border-l border-gray-300 ${
                    gridLayout === '3x3' ? 'bg-[#405189] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="3 Columns"
                >
                  <Grid3x3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setGridLayout('4x4')}
                  className={`px-3 h-10 flex items-center justify-center transition-colors border-l border-gray-300 ${
                    gridLayout === '4x4' ? 'bg-[#405189] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  title="4 Columns"
                >
                  <Grid3x3 className="h-4 w-4" />
                  </button>
                </div>
          )}

          {/* Start All Visible Button */}
          {visibleCameras.length > 0 && (
            <button
                onClick={toggleAllVisibleStreams}
                className="btn-primary h-10 px-4 flex items-center gap-2 flex-shrink-0"
                title="Start/Stop all visible cameras"
              >
                {allStreaming ? (
                  <>
                    <Pause className="h-4 w-4" />
                    <span>Stop All Visible</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    <span>Start All Visible</span>
                  </>
                )}
              </button>
          )}
        </div>
      </div>

      {/* Camera Display */}
      {visibleCameras.length === 0 ? (
        <div className="card p-12 text-center">
          <Webcam className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Cameras Available</h3>
          <p className="text-gray-500">
            {cameras.length === 0
              ? 'No active cameras found in your organization.'
              : 'No cameras match the selected domain filter. Try selecting different domains.'}
          </p>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className={`grid ${getGridCols()} gap-4`}>
              {visibleCameras.map(streamState => (
                <CameraCard
                  key={streamState.camera.id}
                  streamState={streamState}
                  onToggleStream={toggleCameraStream}
                  onDetectionComplete={handleDetectionComplete}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {visibleCameras.map(streamState => (
                <CameraCardList
                  key={streamState.camera.id}
                  streamState={streamState}
                  onToggleStream={toggleCameraStream}
                  onDetectionComplete={handleDetectionComplete}
                />
              ))}
            </div>
          )}

          {/* Total Stats */}
          {visibleCameras.length > 1 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Total Statistics (All Visible Cameras)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-[#405189]">
                    {totalStats.totalDetections}
                  </div>
                  <div className="text-caption text-gray-500">Unique Persons</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#0AB39C]">
                    {totalStats.compliant}
                  </div>
                  <div className="text-caption text-gray-500">Compliant</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#F06548]">
                    {totalStats.violations}
                  </div>
                  <div className="text-caption text-gray-500">Violations</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#F7B84B]">
                    {totalStats.hardHatMissing + totalStats.vestMissing}
                  </div>
                  <div className="text-caption text-gray-500">Missing PPE</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Camera Card Component for Grid View
function CameraCard({
  streamState,
  onToggleStream,
  onDetectionComplete
}: {
  streamState: CameraStreamState
  onToggleStream: (cameraId: number) => void
  onDetectionComplete: (cameraId: number) => (result: any) => Promise<void>
}) {
  return (
    <div className="card p-4 space-y-4">
      {/* Camera Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getDomainIcon(streamState.domain.type)}
          <div>
            <h3 className="font-semibold text-gray-900">{streamState.camera.name}</h3>
            <p className="text-xs text-gray-500">
              {streamState.domain.name} {streamState.camera.location ? `• ${streamState.camera.location}` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggleStream(streamState.camera.id)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
            streamState.isStreaming
              ? 'bg-[#F06548] hover:bg-[#e04d35] text-white'
              : 'bg-[#0AB39C] hover:bg-[#089981] text-white'
          }`}
        >
          {streamState.isStreaming ? (
            <>
              <Pause className="h-3 w-3" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              <span>Start</span>
            </>
          )}
        </button>
      </div>

      {/* Video Stream */}
      <LiveVideoStream
        cameraId={streamState.camera.id}
        isStreaming={streamState.isStreaming}
        domainId={streamState.domain.type}
        domainIdNumber={streamState.domain.id}
        cameraSourceUri={streamState.camera.source_uri}
        cameraSourceType={streamState.camera.source_type}
        onDetectionComplete={onDetectionComplete(streamState.camera.id)}
        noCard={true}
      />

      {/* Camera Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-lg font-bold text-[#405189]">
            {streamState.detectionStats.totalDetections}
          </div>
          <div className="text-xs text-gray-500">Persons</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[#0AB39C]">
            {streamState.detectionStats.compliant}
          </div>
          <div className="text-xs text-gray-500">Compliant</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[#F06548]">
            {streamState.detectionStats.violations}
          </div>
          <div className="text-xs text-gray-500">Violations</div>
        </div>
        <div>
          <div className="text-lg font-bold text-[#F7B84B]">
            {streamState.detectionStats.hardHatMissing + streamState.detectionStats.vestMissing}
          </div>
          <div className="text-xs text-gray-500">Missing PPE</div>
        </div>
      </div>
    </div>
  )
}

// Camera Card Component for List View
function CameraCardList({
  streamState,
  onToggleStream,
  onDetectionComplete
}: {
  streamState: CameraStreamState
  onToggleStream: (cameraId: number) => void
  onDetectionComplete: (cameraId: number) => (result: any) => Promise<void>
}) {
  return (
    <div className="card p-4">
      <div className="flex gap-4">
        {/* Video Stream - Large, takes most of the space */}
        <div className="flex-1 min-w-0">
          <LiveVideoStream
            cameraId={streamState.camera.id}
            isStreaming={streamState.isStreaming}
            domainId={streamState.domain.type}
            domainIdNumber={streamState.domain.id}
            cameraSourceUri={streamState.camera.source_uri}
            cameraSourceType={streamState.camera.source_type}
            onDetectionComplete={onDetectionComplete(streamState.camera.id)}
            noCard={true}
          />
        </div>

        {/* Camera Info and Stats - Right Side, Fixed Width */}
        <div className="flex-shrink-0 w-64 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {getDomainIcon(streamState.domain.type)}
                <div>
                  <h3 className="font-semibold text-gray-900">{streamState.camera.name}</h3>
                  <p className="text-xs text-gray-500">
                    {streamState.domain.name} {streamState.camera.location ? `• ${streamState.camera.location}` : ''}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={() => onToggleStream(streamState.camera.id)}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all mb-4 ${
                streamState.isStreaming
                  ? 'bg-[#F06548] hover:bg-[#e04d35] text-white'
                  : 'bg-[#0AB39C] hover:bg-[#089981] text-white'
              }`}
            >
              {streamState.isStreaming ? (
                <>
                  <Pause className="h-4 w-4" />
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span>Start</span>
                </>
              )}
            </button>
          </div>

          {/* Camera Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-[#405189]">
                {streamState.detectionStats.totalDetections}
              </div>
              <div className="text-xs text-gray-500 mt-1">Persons</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-[#0AB39C]">
                {streamState.detectionStats.compliant}
              </div>
              <div className="text-xs text-gray-500 mt-1">Compliant</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-[#F06548]">
                {streamState.detectionStats.violations}
              </div>
              <div className="text-xs text-gray-500 mt-1">Violations</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-[#F7B84B]">
                {streamState.detectionStats.hardHatMissing + streamState.detectionStats.vestMissing}
              </div>
              <div className="text-xs text-gray-500 mt-1">Missing PPE</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
