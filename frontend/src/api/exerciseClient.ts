import api from './client'
import { Exercise, ExerciseCreate, ExerciseUpdate } from '../types'

export const exerciseClient = {
  // List all exercises
  list: async (isActive?: boolean): Promise<Exercise[]> => {
    const params = new URLSearchParams()
    if (isActive !== undefined) {
      params.set('is_active', String(isActive))
    }
    
    const queryString = params.toString()
    const url = queryString ? `/api/exercises/?${queryString}` : '/api/exercises/'
    
    const response = await api.get(url)
    return response.data
  },

  // Get a specific exercise
  get: async (id: number): Promise<Exercise> => {
    const response = await api.get(`/api/exercises/${id}`)
    return response.data
  },

  // Create a new exercise
  create: async (data: ExerciseCreate): Promise<Exercise> => {
    const response = await api.post('/api/exercises/', data)
    return response.data
  },

  // Update an existing exercise
  update: async (id: number, data: ExerciseUpdate): Promise<Exercise> => {
    const response = await api.put(`/api/exercises/${id}`, data)
    return response.data
  },

  // Delete an exercise (soft delete if has associated requests)
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete(`/api/exercises/${id}`)
    return response.data
  },

  // Get count of requests for an exercise
  getRequestCount: async (id: number): Promise<{ exercise_id: number; request_count: number }> => {
    const response = await api.get(`/api/exercises/${id}/requests/count`)
    return response.data
  },

  // Get the default exercise
  getDefault: async (): Promise<Exercise | null> => {
    const response = await api.get('/api/exercises/default')
    return response.data
  },

  // Set an exercise as default
  setDefault: async (id: number): Promise<Exercise> => {
    const response = await api.post(`/api/exercises/${id}/set-default`)
    return response.data
  },
}