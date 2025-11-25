import { httpClient } from '../httpClient'

export interface DetectionRequestOptions {
  confidence?: number
}

export interface DetectionResult {
  success: boolean
  detections: Array<{
    person_id?: number
    bbox: { x: number; y: number; w: number; h: number }
    detected_ppe: Array<{ type: string; confidence: number }>
    missing_ppe: Array<{ type: string; required?: boolean }>
    compliance?: boolean
    confidence?: number
  }>
  frame_shape: {
    width: number
    height: number
  }
}

class DetectionService {
  private readonly basePath = '/detection'

  async detectFrame(frame: Blob, options?: DetectionRequestOptions): Promise<DetectionResult> {
    const formData = new FormData()
    formData.append('file', frame, 'frame.jpg')

    return httpClient.post<DetectionResult>(`${this.basePath}/detect-frame`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      params: {
        confidence: options?.confidence ?? 0.5,
      },
    })
  }
}

export const detectionService = new DetectionService()


