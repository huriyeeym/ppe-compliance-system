/**
 * PPE Type Service
 *
 * Fetches PPE type metadata so UI can label rules properly.
 */

import { httpClient } from '../httpClient'

export type PPETypeStatus = 'active' | 'planned'

export interface PPEType {
  id: number
  name: string
  display_name: string
  category: string
  model_class_name?: string
  status: PPETypeStatus
  created_at: string
}

class PPETypeService {
  private readonly basePath = '/ppe-types'

  async getAll(skip = 0, limit = 100): Promise<PPEType[]> {
    return httpClient.get<PPEType[]>(this.basePath, { params: { skip, limit } })
  }
}

export const ppeTypeService = new PPETypeService()


