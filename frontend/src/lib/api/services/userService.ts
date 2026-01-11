import { httpClient } from '../httpClient'
import type { User } from './authService'

export interface CreateUserPayload {
  email: string
  full_name: string
  password: string
  role: 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer'
  domain_ids?: number[]
  permissions?: string[]
}

export interface UpdateUserPayload {
  email?: string
  full_name?: string
  password?: string
  role?: 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer'
  domain_id?: number | null
  domain_ids?: number[]
  permissions?: string[]
  is_active?: boolean
}

export interface UserPhoto {
  id: number
  user_id: number
  photo_path: string
  face_encoding: number[] | null
  is_primary: boolean
  uploaded_at: string
  uploaded_by: number | null
}

class UserService {
  private readonly basePath = '/users'

  async getAll(skip: number = 0, limit: number = 20): Promise<{ items: User[]; total: number; skip: number; limit: number }> {
    return httpClient.get<{ items: User[]; total: number; skip: number; limit: number }>(this.basePath, {
      params: { skip, limit }
    })
  }

  async create(payload: CreateUserPayload): Promise<User> {
    return httpClient.post<User>(this.basePath, payload)
  }

  async update(id: number, payload: UpdateUserPayload): Promise<User> {
    return httpClient.put<User>(`${this.basePath}/${id}`, payload)
  }

  async delete(id: number): Promise<void> {
    return httpClient.delete(`${this.basePath}/${id}`)
  }

  // Photo management methods
  async uploadPhoto(userId: number, file: File, isPrimary: boolean = false): Promise<UserPhoto> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('is_primary', isPrimary.toString())
    
    return httpClient.post<UserPhoto>(`${this.basePath}/${userId}/photos`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 600000, // 10 minutes - DeepFace model download can take 5+ minutes on first upload
    })
  }

  async getPhotos(userId: number): Promise<UserPhoto[]> {
    return httpClient.get<UserPhoto[]>(`${this.basePath}/${userId}/photos`)
  }

  async deletePhoto(userId: number, photoId: number): Promise<void> {
    return httpClient.delete(`${this.basePath}/${userId}/photos/${photoId}`)
  }

  async setPrimaryPhoto(userId: number, photoId: number): Promise<UserPhoto> {
    return httpClient.put<UserPhoto>(`${this.basePath}/${userId}/photos/${photoId}/set-primary`)
  }
}

export const userService = new UserService()

export type { User }
