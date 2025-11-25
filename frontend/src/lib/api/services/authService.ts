import { httpClient } from '../httpClient'

export interface User {
  id: number
  email: string
  full_name: string
  role: 'admin' | 'operator'
  is_active: boolean
  created_at: string
  last_login?: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

class AuthService {
  private readonly basePath = '/auth'

  async login(email: string, password: string): Promise<LoginResponse> {
    const params = new URLSearchParams()
    params.append('username', email)
    params.append('password', password)

    return httpClient.post<LoginResponse>(`${this.basePath}/login`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  }

  async me(): Promise<User> {
    return httpClient.get<User>(`${this.basePath}/me`)
  }
}

export const authService = new AuthService()

