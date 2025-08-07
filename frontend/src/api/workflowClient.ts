import axios from 'axios'
import type {
  Workflow,
  WorkflowList,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
  WorkflowFilters
} from '../types/workflow'

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

const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes
})

// Request interceptor for logging
api.interceptors.request.use((config) => {
  console.log(`Workflow API Request: ${config.method?.toUpperCase()} ${config.url}`)
  if (config.data) {
    console.log('Request payload:', JSON.stringify(config.data, null, 2))
  }
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