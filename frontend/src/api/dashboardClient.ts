import { DashboardConfig } from '../types/workflow'

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