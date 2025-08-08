import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskflowApi } from '../api/client'
import type { 
  RequestFilters, 
  CreateRequestPayload, 
  UpdateStatusPayload, 
  ProcessRequestPayload,
  Task 
} from '../types'

export const useRequests = (filters: RequestFilters = {}) => {
  return useQuery({
    queryKey: ['requests', filters],
    queryFn: () => taskflowApi.getRequests(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes - requests list doesn't change frequently
    refetchOnWindowFocus: false, // Don't refetch on window focus
  })
}

export const useRequest = (id: number) => {
  return useQuery({
    queryKey: ['request', id],
    queryFn: () => taskflowApi.getRequest(id),
    enabled: !!id,
  })
}

export const useCreateRequest = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (payload: CreateRequestPayload) => taskflowApi.createRequest(payload),
    onSuccess: () => {
      // Invalidate requests list to refetch
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export const useUpdateRequestStatus = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateStatusPayload }) =>
      taskflowApi.updateRequestStatus(id, payload),
    onSuccess: (_, { id }) => {
      // Invalidate both the specific request and the requests list
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export const useProcessRequest = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ProcessRequestPayload }) =>
      taskflowApi.processRequest(id, payload),
    onSuccess: (_, { id }) => {
      // Invalidate the specific request to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['request', id] })
    },
  })
}

export const useUpdateRequest = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Task> }) =>
      taskflowApi.updateRequest(id, payload),
    onSuccess: (_, { id }) => {
      // Invalidate both the specific request and the requests list
      queryClient.invalidateQueries({ queryKey: ['request', id] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export const useDeleteRequest = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => taskflowApi.deleteRequest(id),
    onSuccess: () => {
      // Invalidate requests list to refetch
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
  })
}

export const useJobStatus = (jobId: string, enabled = true) => {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => taskflowApi.getJobStatus(jobId),
    enabled: enabled && !!jobId,
    refetchInterval: (query) => {
      // Stop polling if job is completed or failed
      if (query.state.data?.status === 'COMPLETED' || query.state.data?.status === 'FAILED') {
        return false
      }
      return 2000 // Poll every 2 seconds
    },
  })
}