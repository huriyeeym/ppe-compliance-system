import { httpClient } from '../httpClient'
import type { User } from './authService'

export interface CreateUserPayload {
  email: string
  full_name: string
  password: string
  role: 'admin' | 'operator'
}

export interface UpdateUserPayload {
  email?: string
  full_name?: string
  password?: string
  role?: 'admin' | 'operator'
  is_active?: boolean
}

class UserService {
  private readonly basePath = '/users'

  async getAll(): Promise<User[]> {
    return httpClient.get<User[]>(this.basePath)
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
}

export const userService = new UserService()

export type { User }
