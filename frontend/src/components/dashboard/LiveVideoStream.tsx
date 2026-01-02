import { useRef, useEffect, useState } from 'react'
import { detectionService } from '../../lib/api/services/detectionService'
import { logger } from '../../lib/utils/logger'

interface LiveVideoStreamProps {
  cameraId: number
  isStreaming: boolean
  domainId: string
  onDetectionComplete?: (result: DetectionResult) => void
}

interface DetectionResult {
  detections: Detection[]
  violations_recorded: RecordedViolation[]
  recording_stats: {
    total_recordings: number
    active_sessions: number
    recording_rate: number
  }
  frame_snapshot?: string
}

interface RecordedViolation {
  track_id: number
  reason: string
  snapshot_path: string
}

interface Detection {
  person_id: number
  track_id: number | null
  bbox: { x: number; y: number; w: number; h: number }
  ppe_status: {
    hard_hat: { detected: boolean; confidence: number }
    safety_vest: { detected: boolean; confidence: number }
  }
  compliance: boolean
}

/**
 * Live Video Stream Component
 *
 * Real workflow for construction site:
 * 1. Start webcam stream
 * 2. Send frames to backend (WebSocket or REST)
 * 3. Backend performs YOLOv8 detection
 * 4. Detection results are returned
 * 5. Draw with canvas overlay:
 *    - Person bounding box (green: compliant, red: violation)
 *    - PPE status badges (✓ Hard Hat, ✗ Safety Vest)
 * 6. If violation detected:
 *    - Call onViolationDetected callback
 *    - Save frame snapshot
 *    - Create violation record in database
 */
export default function LiveVideoStream({
  cameraId,
  isStreaming,
  domainId,
  onDetectionComplete
}: LiveVideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [fps, setFps] = useState(0)
  const [detectionFps, setDetectionFps] = useState(0)
  const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Start webcam stream
  useEffect(() => {
    if (!isStreaming) {
      // Stop stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
      return
    }

    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch((err) => {
        logger.error('Webcam access error', err)
      })

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isStreaming])

  // Detection results via backend API
  useEffect(() => {
    if (!isStreaming) {
      setDetections([])
      return
    }

    let isMounted = true
    let detecting = false
    let lastDetectionTime = performance.now()

    const runDetection = async () => {
      if (!videoRef.current) {
        console.log('[LiveVideoStream] runDetection: no video ref')
        return
      }
      const video = videoRef.current

      if (!video.videoWidth || !video.videoHeight) {
        console.log('[LiveVideoStream] runDetection: video not ready')
        return
      }
      if (detecting) {
        console.log('[LiveVideoStream] runDetection: already detecting, skipping')
        return
      }
      console.log('[LiveVideoStream] runDetection: starting detection...')

      if (!detectionCanvasRef.current) {
        detectionCanvasRef.current = document.createElement('canvas')
      }
      const canvas = detectionCanvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      detecting = true
      canvas.toBlob(async (blob) => {
        if (!blob || !isMounted) {
          detecting = false
          return
        }
        try {
          const result = await detectionService.detectFrame(blob)
          console.log('[LiveVideoStream] API Response received:', result)
          if (!isMounted) return

          const rawDetections = Array.isArray(result?.detections) ? result.detections : []

          const mappedDetections: Detection[] = rawDetections.map((det, index) => {
            const detectedPpe = Array.isArray(det.detected_ppe) ? det.detected_ppe : []
            const missingPpe = Array.isArray(det.missing_ppe) ? det.missing_ppe : []

            const hardHatStatus = detectedPpe.find((ppe) => ppe.type === 'hard_hat')
            const vestStatus = detectedPpe.find((ppe) => ppe.type === 'safety_vest')
            const missingHardHat = missingPpe.some((ppe) => ppe.type === 'hard_hat')
            const missingVest = missingPpe.some((ppe) => ppe.type === 'safety_vest')

            return {
              person_id: det.person_id ?? index + 1,
              track_id: det.track_id ?? null,
              bbox: det.bbox,
              ppe_status: {
                hard_hat: {
                  detected: !missingHardHat || !!hardHatStatus,
                  confidence: hardHatStatus?.confidence ?? 0,
                },
                safety_vest: {
                  detected: !missingVest || !!vestStatus,
                  confidence: vestStatus?.confidence ?? 0,
                },
              },
              compliance: missingPpe.length === 0,
            }
          })

          setDetections(mappedDetections)
          const now = performance.now()
          const elapsed = now - lastDetectionTime
          setDetectionFps(Math.round(1000 / Math.max(elapsed, 1)))
          lastDetectionTime = now

          // ✅ Pass full backend response to parent (includes smart recording decisions)
          if (onDetectionComplete) {
            console.log('[LiveVideoStream] About to call onDetectionComplete with:', {
              detections_count: mappedDetections.length,
              violations_recorded_count: result.violations_recorded?.length || 0,
              recording_stats: result.recording_stats
            })
            const overlayCanvas = canvasRef.current
            let frameSnapshot: string | undefined
            if (overlayCanvas) {
              frameSnapshot = overlayCanvas.toDataURL('image/jpeg', 0.8)
            }

            try {
              onDetectionComplete({
                detections: mappedDetections,
                violations_recorded: result.violations_recorded || [],
                recording_stats: result.recording_stats || {
                  total_recordings: 0,
                  active_sessions: 0,
                  recording_rate: 0
                },
                frame_snapshot: frameSnapshot
              })
              console.log('[LiveVideoStream] onDetectionComplete called successfully')
            } catch (callbackErr) {
              console.error('[LiveVideoStream] Error in onDetectionComplete callback:', callbackErr)
            }
          } else {
            console.warn('[LiveVideoStream] onDetectionComplete callback is not defined!')
          }
        } catch (err) {
          console.error('[LiveVideoStream] Detection failed:', err)
          logger.error('Detection failed', err)
        } finally {
          detecting = false
        }
      }, 'image/jpeg', 0.7)
    }

    const interval = setInterval(runDetection, 800)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isStreaming, cameraId, domainId, onDetectionComplete])

  // Video FPS hesapla
  useEffect(() => {
    if (!isStreaming || !videoRef.current) return

    let frameCount = 0
    const startTime = Date.now()

    const countFps = () => {
      frameCount++
      const elapsed = (Date.now() - startTime) / 1000
      if (elapsed >= 1) {
        setFps(Math.floor(frameCount / elapsed))
        frameCount = 0
      }
      requestAnimationFrame(countFps)
    }

    countFps()
  }, [isStreaming])

  // Canvas overlay çiz
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      // Canvas boyutunu video'ya göre ayarla
      if (videoRef.current) {
        const video = videoRef.current
        if (video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
      }

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Detection overlay çiz
      detections.forEach((det) => {
        const { bbox, ppe_status, compliance } = det

        // Person bounding box
        ctx.strokeStyle = compliance ? '#10B981' : '#EF4444'
        ctx.lineWidth = 3
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h)

        // PPE status badges - For construction: Hard Hat and Safety Vest
        const badgeY = bbox.y - 35
        let badgeX = bbox.x

        // Hard hat status
        if (ppe_status.hard_hat.detected) {
          ctx.fillStyle = '#10B981'
          ctx.fillRect(badgeX, badgeY, 70, 25)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText('✓ Hard Hat', badgeX + 5, badgeY + 17)
          badgeX += 75
        } else {
          ctx.fillStyle = '#EF4444'
          ctx.fillRect(badgeX, badgeY, 70, 25)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText('✗ Hard Hat', badgeX + 5, badgeY + 17)
          badgeX += 75
        }

        // Yelek durumu
        if (ppe_status.safety_vest.detected) {
          ctx.fillStyle = '#10B981'
          ctx.fillRect(badgeX, badgeY, 70, 25)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText('✓ Safety Vest', badgeX + 5, badgeY + 17)
        } else {
          ctx.fillStyle = '#EF4444'
          ctx.fillRect(badgeX, badgeY, 70, 25)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText('✗ Safety Vest', badgeX + 5, badgeY + 17)
        }

        // Person ID
        ctx.fillStyle = '#000000'
        ctx.fillRect(bbox.x, bbox.y - 20, 30, 20)
        ctx.fillStyle = '#FFFFFF'
        ctx.font = 'bold 12px sans-serif'
        ctx.fillText(`#${det.person_id}`, bbox.x + 5, bbox.y - 5)
      })

      requestAnimationFrame(draw)
    }

    draw()
  }, [detections])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-section-title">Live Video Stream</h3>
          <p className="text-caption text-slate-500 mt-1">
            {isStreaming ? `Video: ${fps} FPS • Detection: ${detectionFps} FPS` : 'Stopped'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
          <span className="text-caption text-slate-400">
            {isStreaming ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
        
        {/* Placeholder - Stream kapalıyken */}
        {!isStreaming && (
          <div className="aspect-video flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4 opacity-30">📹</div>
              <p className="text-body text-slate-500">Video stream not started</p>
              <p className="text-caption text-slate-600 mt-1">
                Click the "Start" button to activate the webcam
              </p>
            </div>
          </div>
        )}

        {/* Detection Info Overlay */}
        {isStreaming && detections.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-slate-900/90 px-3 py-2 rounded-lg">
            <p className="text-xs text-slate-300">
              {detections.length} people detected
            </p>
            <p className="text-xs text-slate-500">
              {detections.filter(d => d.compliance).length} compliant,{' '}
              {detections.filter(d => !d.compliance).length} violations
            </p>
          </div>
        )}
      </div>

      {/* Detection Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-green-400"></div>
          <span>Compliant (Hard Hat + Vest present)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-red-400"></div>
          <span>Violation (Hard Hat or Vest missing)</span>
        </div>
      </div>
    </div>
  )
}
