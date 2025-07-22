import axios from 'axios'
import { API_BASE_URL } from './client'

export interface GroundTruthData {
  id?: number
  request_id: number
  workflow_block_id: number
  field_path: string
  ai_value?: any
  ground_truth_value: any
  created_by?: number
  created_at?: string
  updated_at?: string
  notes?: string
  workflow_block_name?: string
  created_by_name?: string
}

export interface UserPreferences {
  fine_tuning_mode: boolean
}

class GroundTruthClient {
  private baseURL: string

  constructor() {
    this.baseURL = `${API_BASE_URL}/api`
  }

  // Ground Truth API
  async createOrUpdateGroundTruth(data: GroundTruthData): Promise<GroundTruthData> {
    const response = await axios.post(`${this.baseURL}/ground-truth`, data)
    return response.data
  }

  async getGroundTruthForRequest(requestId: number): Promise<GroundTruthData[]> {
    const response = await axios.get(`${this.baseURL}/ground-truth/request/${requestId}`)
    return response.data
  }

  async getGroundTruthForField(
    requestId: number, 
    workflowBlockId: number, 
    fieldPath: string
  ): Promise<GroundTruthData | null> {
    const response = await axios.get(`${this.baseURL}/ground-truth/field`, {
      params: {
        request_id: requestId,
        workflow_block_id: workflowBlockId,
        field_path: fieldPath
      }
    })
    return response.data
  }

  async deleteGroundTruth(id: number): Promise<void> {
    await axios.delete(`${this.baseURL}/ground-truth/${id}`)
  }

  // User Preferences API
  async getUserPreferences(): Promise<UserPreferences> {
    const response = await axios.get(`${this.baseURL}/user-preferences`)
    return response.data
  }

  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    const response = await axios.put(`${this.baseURL}/user-preferences`, preferences)
    return response.data
  }
}

export const groundTruthClient = new GroundTruthClient()