import api from './client'

export interface CustomInstruction {
  id: number
  request_id: number
  workflow_block_id: number
  instruction_text: string
  is_active: boolean
  workflow_block_name: string
  created_at: string
  updated_at: string
}

export interface CreateCustomInstructionRequest {
  workflow_block_id: number
  instruction_text: string
}

export interface UpdateCustomInstructionRequest {
  instruction_text?: string
  is_active?: boolean
}

export const customInstructionsApi = {
  // Get all custom instructions for a request
  getInstructions: async (requestId: number): Promise<CustomInstruction[]> => {
    const response = await api.get(`/api/requests/${requestId}/custom-instructions`)
    return response.data
  },

  // Create a new custom instruction
  createInstruction: async (
    requestId: number, 
    workflowBlockId: number, 
    instructionText: string
  ): Promise<CustomInstruction> => {
    const response = await api.post(`/api/requests/${requestId}/custom-instructions`, {
      workflow_block_id: workflowBlockId,
      instruction_text: instructionText
    })
    return response.data
  },

  // Update an existing custom instruction
  updateInstruction: async (
    requestId: number, 
    instructionId: number, 
    updateData: UpdateCustomInstructionRequest
  ): Promise<CustomInstruction> => {
    const response = await api.put(
      `/api/requests/${requestId}/custom-instructions/${instructionId}`, 
      updateData
    )
    return response.data
  },

  // Delete (deactivate) a custom instruction
  deleteInstruction: async (requestId: number, instructionId: number): Promise<void> => {
    await api.delete(`/api/requests/${requestId}/custom-instructions/${instructionId}`)
  }
}