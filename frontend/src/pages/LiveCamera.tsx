import { useState, useEffect } from 'react'
import { Volume2, VolumeX, Play, Pause, Construction, Factory, Warehouse, Pickaxe, Cross, UtensilsCrossed, Building2, XCircle } from 'lucide-react'
import LiveVideoStream from '../components/dashboard/LiveVideoStream'
import { domainService, type Domain } from '../lib/api/services/domainService'
import { cameraService, type Camera } from '../lib/api/services/cameraService'
import { violationService } from '../lib/api/services/violationService'
import { logger } from '../lib/utils/logger'
import { showViolationAlert, showSuccessAlert } from '../components/alerts/ViolationAlert'
import { audioAlert } from '../lib/utils/audioAlert'
import CustomSelect from '../components/common/CustomSelect'

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

/**
 * Live Camera Page
 *
 * For construction site:
 * - Full screen video stream
 * - Person + PPE detection overlay
 * - Alert on violation
 * - Detection statistics
 */
export default function LiveCamera() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [detectionStats, setDetectionStats] = useState({
    totalDetections: 0,
    compliant: 0,
    violations: 0,
    hardHatMissing: 0,
    vestMissing: 0,
  })

  // Load domain and camera
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
          setError('Construction site not found')
        }
      } catch (err) {
        logger.error('LiveCamera data load error', err)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

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
    console.log('[LiveCamera] handleDetectionComplete CALLED!', result)
    if (!selectedDomain || !selectedCamera) {
      console.warn('[LiveCamera] No domain or camera selected, returning early')
      return
    }

    logger.debug('Detection complete', {
      detections: result.detections.length,
      violations_recorded: result.violations_recorded.length,
      recording_stats: result.recording_stats
    })

    // ✅ Update stats based on ALL detections
    const violationCount = result.detections.filter(d => !d.compliance).length
    setDetectionStats((prev) => ({
      ...prev,
      violations: prev.violations + result.violations_recorded.length, // Only count RECORDED violations
      totalDetections: prev.totalDetections + result.detections.length,
      compliant: prev.compliant + result.detections.filter(d => d.compliance).length,
      hardHatMissing: prev.hardHatMissing + result.detections.filter(
        d => !d.ppe_status.hard_hat.detected
      ).length,
      vestMissing: prev.vestMissing + result.detections.filter(
        d => !d.ppe_status.safety_vest.detected
      ).length,
    }))

    // ✅ Only save violations that backend says should be recorded
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
        const missing_ppe_labels: string[] = []
        if (!detection.ppe_status.hard_hat.detected) {
          missing_ppe.push('hard_hat')
          missing_ppe_labels.push('Hard Hat')
        }
        if (!detection.ppe_status.safety_vest.detected) {
          missing_ppe.push('safety_vest')
          missing_ppe_labels.push('Safety Vest')
        }

        // Determine severity based on missing PPE count
        const severity: 'low' | 'medium' | 'high' | 'critical' =
          missing_ppe.length >= 2 ? 'critical' :
          missing_ppe.length === 1 && missing_ppe.includes('hard_hat') ? 'high' : 'medium'

        // Show violation alert with sound
        showViolationAlert({
          track_id: recordedViolation.track_id,
          reason: recordedViolation.reason,
          missing_ppe: missing_ppe_labels,
          severity,
          timestamp: new Date().toISOString(),
        })

        let frameSnapshot = result.frame_snapshot
        if (frameSnapshot && frameSnapshot.length > 500) {
          frameSnapshot = frameSnapshot.slice(0, 500)
        }

        // Create violation record in database
        await violationService.create({
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
        })

        logger.info('Violation saved to database', {
          track_id: recordedViolation.track_id,
          reason: recordedViolation.reason,
          snapshot_path: recordedViolation.snapshot_path
        })
      } catch (err) {
        logger.error('Failed to save violation', err)
      }
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#405189] mx-auto mb-4"></div>
            <p className="text-body text-gray-500">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !selectedDomain || !selectedCamera) {
    return (
      <div className="p-6">
        <div className="card">
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-section-title mb-2">Error</h3>
            <p className="text-body text-gray-500">{error || 'Camera not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#405189]/10 rounded-lg flex items-center justify-center">
            {getDomainIcon(selectedDomain.type)}
          </div>
          <div>
            <h1 className="text-page-title">
              {selectedDomain.name} - Live Camera
            </h1>
            <p className="text-caption text-gray-500">
              {selectedCamera.name} {selectedCamera.location ? `• ${selectedCamera.location}` : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
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
          <CustomSelect
            value={selectedCamera.id}
            onChange={(val) => {
              const cameraId = Number(val)
              const camera = cameras.find(c => c.id === cameraId)
              if (camera) {
                setSelectedCamera(camera)
                setIsStreaming(false)
              }
            }}
            options={cameras.map(camera => ({
              value: camera.id,
              label: camera.name
            }))}
          />
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              isStreaming
                ? 'bg-[#F06548] hover:bg-[#e04d35] text-white'
                : 'btn-success'
            }`}
          >
            {isStreaming ? (
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
      </div>

      {/* Video Stream - Full Screen */}
      <LiveVideoStream
        cameraId={selectedCamera.id}
        isStreaming={isStreaming}
        domainId={selectedDomain.type}
        onDetectionComplete={handleDetectionComplete}
      />

      {/* Detection Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-[#405189] mb-1">
            {detectionStats.totalDetections}
          </div>
          <div className="text-caption text-gray-500">Total Detections</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-[#0AB39C] mb-1">
            {detectionStats.compliant}
          </div>
          <div className="text-caption text-gray-500">Compliant</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-[#F06548] mb-1">
            {detectionStats.violations}
          </div>
          <div className="text-caption text-gray-500">Violations</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-[#F7B84B] mb-1">
            {detectionStats.hardHatMissing + detectionStats.vestMissing}
          </div>
          <div className="text-caption text-gray-500">Missing PPE</div>
        </div>
      </div>
    </div>
  )
}
