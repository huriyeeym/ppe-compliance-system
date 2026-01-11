import { httpClient } from '../httpClient'

export interface Domain {
  id: number
  name: string
  type: string
  icon?: string | null
  description?: string | null
  status: string
  created_at: string
  model_status?: string
  model_last_updated?: string | null
}

export interface User {
  id: number
  email: string
  full_name: string
  role: 'super_admin' | 'admin' | 'manager' | 'operator' | 'viewer'
  domain_id?: number | null
  organization_id?: number | null
  permissions?: string[]
  is_active: boolean
  created_at: string
  last_login?: string | null
  domains?: Domain[] | null
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

  async register(email: string, password: string, fullName: string, organizationName?: string): Promise<LoginResponse> {
    return httpClient.post<LoginResponse>(`${this.basePath}/register`, {
      email,
      password,
      full_name: fullName,
      organization_name: organizationName,
      role: 'viewer' // Default role for self-registration (more secure than 'operator')
    })
  }

  async me(): Promise<User> {
    return httpClient.get<User>(`${this.basePath}/me`)
  }

  async selectDomains(domainIds: number[]): Promise<{ message: string; domains: Array<{ id: number; name: string; type: string }> }> {
    return httpClient.post<{ message: string; domains: Array<{ id: number; name: string; type: string }> }>(
      `${this.basePath}/select-domains`,
      { domain_ids: domainIds }
    )
  }
}

export const authService = new AuthService()

