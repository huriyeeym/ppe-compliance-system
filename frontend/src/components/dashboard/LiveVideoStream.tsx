import { useRef, useEffect, useState } from 'react'
import { detectionService } from '../../lib/api/services/detectionService'
import { logger } from '../../lib/utils/logger'

interface LiveVideoStreamProps {
  cameraId: number
  isStreaming: boolean
  domainId: string  // Domain type (e.g., 'construction')
  domainIdNumber?: number  // Domain ID number (optional, for violation recording)
  cameraSourceUri?: string  // Camera source URI (e.g., "0", "1", "rtsp://...")
  cameraSourceType?: string  // Camera source type (e.g., "webcam", "rtsp", "file")
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
  domainIdNumber,
  cameraSourceUri,
  cameraSourceType,
  onDetectionComplete
}: LiveVideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [fps, setFps] = useState(0)
  const detectionCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null)

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

    // RTSP veya file source ise, backend'den stream al (şimdilik sadece webcam destekliyoruz)
    if (cameraSourceType === 'rtsp' || cameraSourceType === 'file') {
      logger.warn('RTSP and file sources are not yet supported in frontend. Please use webcam source.')
      return
    }

    // Webcam için: source_uri'yi kullan (e.g., "0", "1", "2")
    const startCamera = async () => {
      try {
        let constraints: MediaStreamConstraints = { video: true }
        
        // Eğer source_uri belirtilmişse, o kamerayı seç
        if (cameraSourceUri && cameraSourceType === 'webcam') {
          try {
            // Tüm kameraları listele
            const devices = await navigator.mediaDevices.enumerateDevices()
            const videoDevices = devices.filter(device => device.kind === 'videoinput')
            
            logger.info(`Found ${videoDevices.length} video devices`)
            videoDevices.forEach((d, i) => {
              logger.info(`  [${i}] ${d.label || 'Unknown'} (deviceId: ${d.deviceId.substring(0, 20)}...)`)
            })
            
            // Önce OBS Virtual Camera'yı label'a göre bul (eğer varsa)
            let selectedDevice = null
            const obsCamera = videoDevices.find(device => {
              const label = (device.label || '').toLowerCase()
              return label.includes('obs') || label.includes('virtual') || label.includes('droidcam')
            })
            
            if (obsCamera) {
              selectedDevice = obsCamera
              logger.info(`✅ Found OBS/Virtual Camera: ${obsCamera.label || 'Unknown'}`)
            } else {
              // OBS bulunamazsa, source_uri'ye göre index kullan
              const cameraIndex = parseInt(cameraSourceUri, 10)
              if (!isNaN(cameraIndex) && videoDevices[cameraIndex]) {
                selectedDevice = videoDevices[cameraIndex]
                logger.info(`✅ Selecting camera at index ${cameraIndex}: ${selectedDevice.label || 'Unknown'}`)
              } else if (!isNaN(cameraIndex)) {
                logger.warn(`⚠️ Camera index ${cameraIndex} not found (total: ${videoDevices.length}), trying all cameras...`)
                // Tüm kameraları sırayla dene
                for (let i = 0; i < videoDevices.length; i++) {
                  try {
                    const testConstraints = {
                      video: { deviceId: { exact: videoDevices[i].deviceId } }
                    }
                    const testStream = await navigator.mediaDevices.getUserMedia(testConstraints)
                    testStream.getTracks().forEach(track => track.stop())
                    selectedDevice = videoDevices[i]
                    logger.info(`✅ Found working camera at index ${i}: ${selectedDevice.label || 'Unknown'}`)
                    break
                  } catch (testErr) {
                    logger.debug(`Camera ${i} not available: ${testErr}`)
                  }
                }
              }
            }
            
            if (selectedDevice) {
              constraints = {
                video: {
                  deviceId: { exact: selectedDevice.deviceId }
                }
              }
            } else {
              logger.warn('No suitable camera found, using default')
            }
          } catch (enumErr) {
            logger.warn('Could not enumerate devices, using default camera', enumErr)
          }
        }
        
        // Kamera stream'ini başlat
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          // Video boyutunu al
          videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
              setVideoSize({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight
              })
              logger.info(`Video stream started: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`)
            }
          }
        }
      } catch (err: any) {
        logger.error('Webcam access error', err)
        
        // Eğer belirli kamera bulunamazsa ve source_uri varsa, default kamerayı dene
        if (cameraSourceUri && err.name !== 'NotAllowedError') {
          logger.info('Trying default camera as fallback...')
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true })
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream
            }
          } catch (fallbackErr) {
            logger.error('Fallback camera also failed', fallbackErr)
          }
        }
      }
    }

    startCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isStreaming, cameraSourceUri, cameraSourceType])

  // Store onDetectionComplete in ref to avoid recreating interval
  const onDetectionCompleteRef = useRef(onDetectionComplete)
  useEffect(() => {
    onDetectionCompleteRef.current = onDetectionComplete
  }, [onDetectionComplete])

  // Detection results via backend API
  useEffect(() => {
    if (!isStreaming) {
      setDetections([])
      // Canvas'ı temizle
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
      }
      return
    }

    let isMounted = true
    let detecting = false
    let detectionCount = 0
    let detectionStartTime = performance.now()

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
          const result = await detectionService.detectFrame(blob, {
            confidence: 0.5,
            camera_id: cameraId,
            domain_id: domainIdNumber  // Domain ID number for violation recording
          })
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
          detectionCount++
          
          // Detection FPS'i hesapla (0.5 saniyede bir reset)
          const totalElapsed = (performance.now() - detectionStartTime) / 1000
          if (totalElapsed >= 0.5) {
            detectionCount = 0
            detectionStartTime = performance.now()
          }

          // ✅ Pass full backend response to parent (includes smart recording decisions)
          const callback = onDetectionCompleteRef.current
          if (callback) {
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
              callback({
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
          }
        } catch (err) {
          console.error('[LiveVideoStream] Detection failed:', err)
          logger.error('Detection failed', err)
        } finally {
          detecting = false
        }
      }, 'image/jpeg', 0.7)
    }

    // Detection interval'i optimize et - daha hızlı detection için
    const interval = setInterval(runDetection, 500) // 800ms'den 500ms'ye düşürdük (2 FPS teorik max)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [isStreaming, cameraId, domainId]) // Remove onDetectionComplete from dependencies

  // Video FPS hesapla - video stream'inin gerçek frame rate'ini ölç
  useEffect(() => {
    if (!isStreaming || !videoRef.current) {
      setFps(0)
      return
    }

    const video = videoRef.current
    let frameCount = 0
    let lastTime = performance.now()
    let animationFrameId: number | null = null

    // Video stream'den frame rate bilgisini al
    const getVideoFrameRate = () => {
      if (video.srcObject) {
        const stream = video.srcObject as MediaStream
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack && 'getSettings' in videoTrack) {
          const settings = videoTrack.getSettings()
          if (settings.frameRate) {
            return Math.round(settings.frameRate)
          }
        }
        // getCapabilities'dan da deneyelim
        if ('getCapabilities' in videoTrack) {
          const capabilities = videoTrack.getCapabilities()
          if (capabilities.frameRate) {
            const frameRate = typeof capabilities.frameRate === 'object' 
              ? capabilities.frameRate.max || capabilities.frameRate.min || 30
              : capabilities.frameRate
            return Math.round(frameRate)
          }
        }
      }
      return null
    }

    // Önce stream'den frame rate'i almayı dene
    const streamFrameRate = getVideoFrameRate()
    if (streamFrameRate) {
      setFps(streamFrameRate)
    } else {
      // Fallback: requestAnimationFrame ile video frame'lerini say
      const countFps = () => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
          frameCount++
          const now = performance.now()
          const elapsed = (now - lastTime) / 1000
          if (elapsed >= 1) {
            setFps(Math.round(frameCount / elapsed))
            frameCount = 0
            lastTime = now
          }
        }
        animationFrameId = requestAnimationFrame(countFps)
      }
      animationFrameId = requestAnimationFrame(countFps)
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [isStreaming])

  // Canvas overlay çiz
  useEffect(() => {
    if (!canvasRef.current) return
    
    // Stream durduğunda canvas'ı temizle
    if (!isStreaming || !videoRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      if (!videoRef.current || !canvasRef.current) return
      
      const video = videoRef.current
      const canvas = canvasRef.current
      
      // Video boyutlarını al
      const videoWidth = video.videoWidth || 0
      const videoHeight = video.videoHeight || 0
      
      if (!videoWidth || !videoHeight) {
        requestAnimationFrame(draw)
        return
      }

      // Canvas internal resolution'ı video ile eşleştir
      canvas.width = videoWidth
      canvas.height = videoHeight

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Detection overlay çiz - video sınırları içinde kalacak şekilde
      detections.forEach((det) => {
        const { bbox, ppe_status, compliance } = det

        // Bbox'ın video sınırları içinde olduğundan emin ol
        const clampedX = Math.max(0, Math.min(bbox.x, videoWidth - 1))
        const clampedY = Math.max(0, Math.min(bbox.y, videoHeight - 1))
        const clampedW = Math.min(bbox.w, videoWidth - clampedX)
        const clampedH = Math.min(bbox.h, videoHeight - clampedY)

        // Person bounding box
        ctx.strokeStyle = compliance ? '#10B981' : '#EF4444'
        ctx.lineWidth = 3
        ctx.strokeRect(clampedX, clampedY, clampedW, clampedH)

        // PPE status badges - For construction: Hard Hat and Safety Vest
        // Badge'leri video sınırları içinde tut
        const badgeHeight = 25
        const badgeY = Math.max(0, clampedY - badgeHeight - 5)
        let badgeX = clampedX

        // Hard hat status
        const hardHatWidth = 70
        if (badgeX + hardHatWidth <= videoWidth) {
          if (ppe_status.hard_hat.detected) {
            ctx.fillStyle = '#10B981'
            ctx.fillRect(badgeX, badgeY, hardHatWidth, badgeHeight)
            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 12px sans-serif'
            ctx.fillText('✓ Hard Hat', badgeX + 5, badgeY + 17)
            badgeX += hardHatWidth + 5
          } else {
            ctx.fillStyle = '#EF4444'
            ctx.fillRect(badgeX, badgeY, hardHatWidth, badgeHeight)
            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 12px sans-serif'
            ctx.fillText('✗ Hard Hat', badgeX + 5, badgeY + 17)
            badgeX += hardHatWidth + 5
          }
        }

        // Safety vest status - sadece video sınırları içindeyse çiz
        const vestWidth = 80
        if (badgeX + vestWidth <= videoWidth && badgeY >= 0) {
          if (ppe_status.safety_vest.detected) {
            ctx.fillStyle = '#10B981'
            ctx.fillRect(badgeX, badgeY, vestWidth, badgeHeight)
            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 12px sans-serif'
            ctx.fillText('✓ Safety Vest', badgeX + 5, badgeY + 17)
          } else {
            ctx.fillStyle = '#EF4444'
            ctx.fillRect(badgeX, badgeY, vestWidth, badgeHeight)
            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 12px sans-serif'
            ctx.fillText('✗ Safety Vest', badgeX + 5, badgeY + 17)
          }
        }

        // Person ID - video sınırları içinde
        const idWidth = 30
        const idHeight = 20
        const idX = clampedX
        const idY = Math.max(0, clampedY - idHeight)
        if (idX + idWidth <= videoWidth && idY >= 0) {
          ctx.fillStyle = '#000000'
          ctx.fillRect(idX, idY, idWidth, idHeight)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText(`#${det.person_id}`, idX + 5, idY + 15)
        }
      })

      requestAnimationFrame(draw)
    }

    draw()
  }, [detections, isStreaming])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-section-title">Live Video Stream</h3>
          <p className="text-caption text-slate-500 mt-1">
            {isStreaming ? `Video: ${fps} FPS` : 'Stopped'}
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
      <div 
        className="relative bg-transparent rounded-lg overflow-hidden border-0 inline-block"
        style={{
          maxWidth: videoSize ? `${Math.min(videoSize.width, window.innerWidth * 0.9)}px` : '100%',
          maxHeight: videoSize ? `${Math.min(videoSize.height, window.innerHeight * 0.7)}px` : '70vh'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="block max-h-[70vh] max-w-full h-auto w-auto rounded-lg"
          style={{ 
            display: isStreaming ? 'block' : 'none',
            maxWidth: '100%'
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none rounded-lg"
          style={{ 
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
        />
        
        {/* Placeholder - Stream kapalıyken */}
        {!isStreaming && (
          <div className="aspect-video flex items-center justify-center w-full min-h-[400px] max-h-[70vh]">
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
