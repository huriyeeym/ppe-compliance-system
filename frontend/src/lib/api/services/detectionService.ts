import { httpClient } from '../httpClient'

export interface DetectionRequestOptions {
  confidence?: number
  camera_id?: number
  domain_id?: number
}

export interface DetectionResult {
  success: boolean
  detections: Array<{
    person_id?: number
    track_id?: number | null
    bbox: { x: number; y: number; w: number; h: number }
    detected_ppe: Array<{ type: string; confidence: number }>
    missing_ppe: Array<{ type: string; required?: boolean }>
    compliance?: boolean
    confidence?: number
    severity?: string
    recorded?: boolean
    snapshot_path?: string | null
  }>
  violations_recorded?: Array<{
    track_id: number
    reason: string
    snapshot_path: string
  }>
  recording_stats?: {
    total_recordings: number
    active_sessions: number
    recording_rate: number
  }
  frame_shape: {
    width: number
    height: number
  }
  smart_recording_enabled?: boolean
}

class DetectionService {
  private readonly basePath = '/detection'

  async detectFrame(frame: Blob, options?: DetectionRequestOptions): Promise<DetectionResult> {
    const formData = new FormData()
    formData.append('file', frame, 'frame.jpg')

    const params: Record<string, any> = {
      confidence: options?.confidence ?? 0.5,
    }
    
    if (options?.camera_id) {
      params.camera_id = options.camera_id
    }
    
    if (options?.domain_id) {
      params.domain_id = options.domain_id
    }

    return httpClient.post<DetectionResult>(`${this.basePath}/detect-frame`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params,
    })
  }
}

export const detectionService = new DetectionService()


