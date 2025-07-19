import { DashboardConfig } from '../types/workflow'

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL !== undefined 
  ? (import.meta as any).env.VITE_API_BASE_URL 
  : ''

export const dashboardClient = {
  async getDashboardConfig(workflowId: number): Promise<DashboardConfig> {
    const response = await fetch(`${API_BASE_URL}/api/workflows/${workflowId}/dashboard`)
    
    if (!response.ok) {
      if (response.status === 404) {
        // Return empty config if not found
        return {
          workflow_id: workflowId,
          fields: [],
          layout: 'grid'
        }
      }
      throw new Error('Failed to fetch dashboard configuration')
    }
    
    return response.json()
  },

  async saveDashboardConfig(workflowId: number, config: DashboardConfig): Promise<DashboardConfig> {
    const response = await fetch(`${API_BASE_URL}/api/workflows/${workflowId}/dashboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
    
    if (!response.ok) {
      throw new Error('Failed to save dashboard configuration')
    }
    
    return response.json()
  }
}