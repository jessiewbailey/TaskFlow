import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowApi } from '../api/workflowClient'
import type { 
  WorkflowFilters, 
  CreateWorkflowRequest, 
  UpdateWorkflowRequest 
} from '../types/workflow'

export const useWorkflows = (filters: WorkflowFilters = {}) => {
  return useQuery({
    queryKey: ['workflows', filters],
    queryFn: () => workflowApi.getWorkflows(filters),
    staleTime: 30 * 1000, // 30 seconds
  })
}

export const useWorkflow = (id: number) => {
  return useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowApi.getWorkflow(id),
    enabled: !!id,
  })
}

export const useCreateWorkflow = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (payload: CreateWorkflowRequest) => workflowApi.createWorkflow(payload),
    onSuccess: () => {
      // Invalidate workflows list to refetch
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })
}

export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ id, workflow }: { id: number; workflow: UpdateWorkflowRequest }) =>
      workflowApi.updateWorkflow(id, workflow),
    onSuccess: (_, { id }) => {
      // Invalidate both the specific workflow and the workflows list
      queryClient.invalidateQueries({ queryKey: ['workflow', id] })
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })
}

export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: (id: number) => workflowApi.deleteWorkflow(id),
    onSuccess: () => {
      // Invalidate workflows list to refetch
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })
}