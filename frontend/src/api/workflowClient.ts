import axios from 'axios'
import type {
  Workflow,
  WorkflowList,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowFilters
} from '../types/workflow'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL !== undefined 
  ? (import.meta as any).env.VITE_API_BASE_URL 
  : ''

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes
})

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`Workflow API Request: ${config.method?.toUpperCase()} ${config.url}`)
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Workflow API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export const workflowApi = {
  // Get list of workflows with filters
  getWorkflows: async (filters: WorkflowFilters = {}): Promise<WorkflowList> => {
    const params = new URLSearchParams()
    
    if (filters.status) params.append('status', filters.status)
    if (filters.page) params.append('page', filters.page.toString())
    if (filters.page_size) params.append('page_size', filters.page_size.toString())
    
    const response = await api.get(`/api/workflows?${params.toString()}`)
    return response.data
  },

  // Get single workflow
  getWorkflow: async (id: number): Promise<Workflow> => {
    const response = await api.get(`/api/workflows/${id}`)
    return response.data
  },

  // Create new workflow
  createWorkflow: async (payload: CreateWorkflowRequest): Promise<Workflow> => {
    const response = await api.post('/api/workflows', payload)
    return response.data
  },

  // Update workflow
  updateWorkflow: async (id: number, payload: UpdateWorkflowRequest): Promise<Workflow> => {
    const response = await api.put(`/api/workflows/${id}`, payload)
    return response.data
  },

  // Delete workflow
  deleteWorkflow: async (id: number): Promise<void> => {
    await api.delete(`/api/workflows/${id}`)
  }
}

export default api