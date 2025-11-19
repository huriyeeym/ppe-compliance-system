import { useRef, useEffect, useState } from 'react'
import { logger } from '../../lib/utils/logger'

interface LiveVideoStreamProps {
  cameraId: number
  isStreaming: boolean
  domainId: string
  onViolationDetected?: (violation: Violation) => void
}

interface Violation {
  timestamp: string
  missing_ppe: string[]
  person_bbox: { x: number; y: number; w: number; h: number }
  confidence: number
  frame_snapshot?: string
}

interface Detection {
  person_id: number
  bbox: { x: number; y: number; w: number; h: number }
  ppe_status: {
    hard_hat: { detected: boolean; confidence: number }
    safety_vest: { detected: boolean; confidence: number }
  }
  compliance: boolean
}

/**
 * Canlı Video Stream Component
 * 
 * İnşaat Alanı için Gerçek Workflow:
 * 1. Webcam stream başlat
 * 2. Backend'e frame gönder (WebSocket veya REST)
 * 3. Backend YOLOv8 ile detection yapar
 * 4. Detection sonuçları geri gelir
 * 5. Canvas overlay ile çiz:
 *    - Person bounding box (yeşil: uyumlu, kırmızı: ihlal)
 *    - PPE status badges (✓ Baret, ✗ Yelek)
 * 6. İhlal varsa:
 *    - onViolationDetected callback çağır
 *    - Frame snapshot kaydet
 *    - Database'e violation kaydı oluştur
 */
export default function LiveVideoStream({ 
  cameraId, 
  isStreaming, 
  domainId,
  onViolationDetected 
}: LiveVideoStreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [detections, setDetections] = useState<Detection[]>([])
  const [fps, setFps] = useState(0)
  const [detectionFps, setDetectionFps] = useState(0)

  // Webcam stream başlat
  useEffect(() => {
    if (!isStreaming) {
      // Stream durdur
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
        logger.error('Webcam erişim hatası', err)
      })

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isStreaming])

  // Detection sonuçlarını al (WebSocket veya polling)
  useEffect(() => {
    if (!isStreaming) return

    // TODO: WebSocket bağlantısı kur
    // ws://localhost:8000/ws/detection?camera_id=${cameraId}&domain_id=${domainId}
    
    // Şimdilik mock detection (her 200ms'de bir)
    const interval = setInterval(() => {
      // Mock detection data - İnşaat alanı için
      const mockDetections: Detection[] = [
        {
          person_id: 1,
          bbox: { x: 100, y: 150, w: 80, h: 180 },
          ppe_status: {
            hard_hat: { detected: true, confidence: 0.95 },
            safety_vest: { detected: false, confidence: 0.0 },
          },
          compliance: false, // Yelek eksik = ihlal
        },
      ]

      setDetections(mockDetections)
      setDetectionFps(Math.floor(Math.random() * 3) + 8) // 8-10 FPS detection rate

      // İhlal kontrolü - İnşaat kurallarına göre
      mockDetections.forEach((det) => {
        if (!det.compliance) {
          const missing: string[] = []
          if (!det.ppe_status.hard_hat.detected) missing.push('hard_hat')
          if (!det.ppe_status.safety_vest.detected) missing.push('safety_vest')

          if (missing.length > 0 && onViolationDetected) {
            // Frame snapshot al (canvas'tan)
            const canvas = canvasRef.current
            let frameSnapshot: string | undefined
            if (canvas) {
              frameSnapshot = canvas.toDataURL('image/jpeg', 0.8)
            }

            onViolationDetected({
              timestamp: new Date().toISOString(),
              missing_ppe: missing,
              person_bbox: det.bbox,
              confidence: 0.9,
              frame_snapshot: frameSnapshot,
            })
          }
        }
      })
    }, 200) // Her 200ms'de bir detection (5 FPS detection rate)

    return () => clearInterval(interval)
  }, [isStreaming, cameraId, domainId, onViolationDetected])

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

      // Temizle
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Detection overlay çiz
      detections.forEach((det) => {
        const { bbox, ppe_status, compliance } = det

        // Person bounding box
        ctx.strokeStyle = compliance ? '#10B981' : '#EF4444'
        ctx.lineWidth = 3
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h)

        // PPE status badges - İnşaat için: Baret ve Yelek
        const badgeY = bbox.y - 35
        let badgeX = bbox.x

        // Baret durumu
        if (ppe_status.hard_hat.detected) {
          ctx.fillStyle = '#10B981'
          ctx.fillRect(badgeX, badgeY, 70, 25)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText('✓ Baret', badgeX + 5, badgeY + 17)
          badgeX += 75
        } else {
          ctx.fillStyle = '#EF4444'
          ctx.fillRect(badgeX, badgeY, 70, 25)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText('✗ Baret', badgeX + 5, badgeY + 17)
          badgeX += 75
        }

        // Yelek durumu
        if (ppe_status.safety_vest.detected) {
          ctx.fillStyle = '#10B981'
          ctx.fillRect(badgeX, badgeY, 70, 25)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText('✓ Yelek', badgeX + 5, badgeY + 17)
        } else {
          ctx.fillStyle = '#EF4444'
          ctx.fillRect(badgeX, badgeY, 70, 25)
          ctx.fillStyle = '#FFFFFF'
          ctx.font = 'bold 12px sans-serif'
          ctx.fillText('✗ Yelek', badgeX + 5, badgeY + 17)
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
          <h3 className="text-section-title">Canlı Video Stream</h3>
          <p className="text-caption text-slate-500 mt-1">
            {isStreaming ? `Video: ${fps} FPS • Detection: ${detectionFps} FPS` : 'Durduruldu'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isStreaming ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`}></div>
          <span className="text-caption text-slate-400">
            {isStreaming ? 'Canlı' : 'Offline'}
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
              <p className="text-body text-slate-500">Video stream başlatılmadı</p>
              <p className="text-caption text-slate-600 mt-1">
                "Başlat" butonuna tıklayarak webcam'i aktif edin
              </p>
            </div>
          </div>
        )}

        {/* Detection Info Overlay */}
        {isStreaming && detections.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-slate-900/90 px-3 py-2 rounded-lg">
            <p className="text-xs text-slate-300">
              {detections.length} kişi tespit edildi
            </p>
            <p className="text-xs text-slate-500">
              {detections.filter(d => d.compliance).length} uyumlu,{' '}
              {detections.filter(d => !d.compliance).length} ihlal
            </p>
          </div>
        )}
      </div>

      {/* Detection Legend */}
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-green-400"></div>
          <span>Uyumlu (Baret + Yelek var)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-red-400"></div>
          <span>İhlal (Baret veya Yelek eksik)</span>
        </div>
      </div>
    </div>
  )
}
