import { httpClient } from '../httpClient'
import type { User } from './authService'

class UserService {
  private readonly basePath = '/users'

  async getAll(): Promise<User[]> {
    return httpClient.get<User[]>(this.basePath)
  }
}

export const userService = new UserService()

