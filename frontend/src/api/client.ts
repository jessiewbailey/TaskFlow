import axios from 'axios'
import type {
  TaskList,
  Task,
  CreateRequestPayload,
  CreateRequestResponse,
  UpdateStatusPayload,
  ProcessRequestPayload,
  JobProgress,
  RequestFilters
} from '../types'
import type { OllamaModelsResponse } from '../types/models'

// Get API base URL from environment
// This handles both Vite (browser) and Node.js (test) environments
declare const process: any;

function getApiBaseUrl(): string {
  // In test/Node.js environment 
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_API_BASE_URL || 'http://localhost:8000';
  }
  
  // In browser with Vite, use import.meta if available
  if (typeof window !== 'undefined') {
    try {
      const meta = (globalThis as any).import?.meta || (global as any).import?.meta;
      return meta?.env?.VITE_API_BASE_URL || '';
    } catch {
      return '';
    }
  }
  
  return 'http://localhost:8000';
}

export const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes
})

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`)
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const taskflowApi = {
  // Get list of requests with filters
  getRequests: async (filters: RequestFilters = {}): Promise<TaskList> => {
    const params = new URLSearchParams()
    
    if (filters.analyst !== undefined) params.append('analyst', filters.analyst.toString())
    if (filters.status) params.append('status', filters.status)
    if (filters.exercise_id !== undefined) params.append('exercise_id', filters.exercise_id.toString())
    if (filters.sort_by) params.append('sort_by', filters.sort_by)
    if (filters.order) params.append('order', filters.order)
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.page_size) params.append('page_size', filters.page_size.toString())
    
    const response = await api.get(`/api/requests?${params.toString()}`)
    return response.data
  },

  // Get single request
  getRequest: async (id: number): Promise<Task> => {
    const response = await api.get(`/api/requests/${id}`)
    return response.data
  },

  // Create new request
  createRequest: async (payload: CreateRequestPayload): Promise<CreateRequestResponse> => {
    const response = await api.post('/api/requests', payload)
    return response.data
  },

  // Update request status
  updateRequestStatus: async (id: number, payload: UpdateStatusPayload): Promise<void> => {
    await api.patch(`/api/requests/${id}/status`, payload)
  },

  // Update request
  updateRequest: async (id: number, payload: Partial<Task>): Promise<Task> => {
    const response = await api.put(`/api/requests/${id}`, payload)
    return response.data
  },

  // Delete request
  deleteRequest: async (id: number): Promise<void> => {
    await api.delete(`/api/requests/${id}`)
  },

  // Process request with custom instructions
  processRequest: async (id: number, payload: ProcessRequestPayload): Promise<{ job_id: string }> => {
    const response = await api.post(`/api/requests/${id}/process`, payload)
    return response.data
  },

  // Get job status
  getJobStatus: async (jobId: string): Promise<JobProgress> => {
    const response = await api.get(`/api/jobs/${jobId}`)
    return response.data
  },

  // Stream job progress (returns EventSource)
  streamJobProgress: (jobId: string): EventSource => {
    return new EventSource(`${API_BASE_URL}/api/jobs/${jobId}/stream`)
  },

  // Get available Ollama models
  getOllamaModels: async (): Promise<OllamaModelsResponse> => {
    try {
      // Call backend API which proxies to Ollama
      const response = await api.get('/api/models/ollama')
      return {
        models: response.data.models || [],
        total: response.data.models?.length || 0
      }
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error)
      return {
        models: [],
        total: 0,
        error: 'Failed to connect to Ollama'
      }
    }
  }
}

export default api