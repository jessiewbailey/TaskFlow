import React, { useState, useEffect } from 'react'
import { PlusIcon, TrashIcon, PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useProcessRequest } from '../hooks/useRequests'
import { customInstructionsApi } from '../api/customInstructionsClient'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface CustomInstructionsProps {
  requestId: number
  workflowBlocks?: Array<{ id: number; name: string; order: number }>
}

interface CustomInstruction {
  id: number
  request_id: number
  workflow_block_id: number
  instruction_text: string
  is_active: boolean
  workflow_block_name: string
  created_at: string
  updated_at: string
}

export const CustomInstructions: React.FC<CustomInstructionsProps> = ({ 
  requestId, 
  workflowBlocks = [] 
}) => {
  const [newInstruction, setNewInstruction] = useState('')
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  
  const processRequest = useProcessRequest()
  const queryClient = useQueryClient()

  // Query for existing custom instructions
  const { data: instructions = [], isLoading } = useQuery({
    queryKey: ['custom-instructions', requestId],
    queryFn: () => customInstructionsApi.getInstructions(requestId),
    enabled: !!requestId
  })

  // Mutation for creating new instruction
  const createMutation = useMutation({
    mutationFn: ({ blockId, text }: { blockId: number; text: string }) =>
      customInstructionsApi.createInstruction(requestId, blockId, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-instructions', requestId] })
      setNewInstruction('')
      setSelectedBlockId(null)
      setShowAddForm(false)
    }
  })

  // Mutation for updating instruction
  const updateMutation = useMutation({
    mutationFn: ({ id, text }: { id: number; text: string }) =>
      customInstructionsApi.updateInstruction(requestId, id, { instruction_text: text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-instructions', requestId] })
      setEditingId(null)
      setEditingText('')
    }
  })

  // Mutation for deleting instruction
  const deleteMutation = useMutation({
    mutationFn: (id: number) => customInstructionsApi.deleteInstruction(requestId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-instructions', requestId] })
    }
  })

  const handleAddInstruction = async () => {
    if (!newInstruction.trim() || !selectedBlockId) return
    
    try {
      await createMutation.mutateAsync({
        blockId: selectedBlockId,
        text: newInstruction.trim()
      })
    } catch (error) {
      console.error('Failed to create instruction:', error)
    }
  }

  const handleUpdateInstruction = async (id: number) => {
    if (!editingText.trim()) return
    
    try {
      await updateMutation.mutateAsync({
        id,
        text: editingText.trim()
      })
    } catch (error) {
      console.error('Failed to update instruction:', error)
    }
  }

  const handleDeleteInstruction = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id)
    } catch (error) {
      console.error('Failed to delete instruction:', error)
    }
  }

  const startEditing = (instruction: CustomInstruction) => {
    setEditingId(instruction.id)
    setEditingText(instruction.instruction_text)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingText('')
  }

  const handleReprocess = async () => {
    try {
      await processRequest.mutateAsync({
        id: requestId,
        payload: { instructions: 'reprocess with custom instructions' }
      })
    } catch (error) {
      console.error('Failed to reprocess request:', error)
    }
  }

  // Get available blocks (those without existing instructions)
  const availableBlocks = workflowBlocks.filter(block => 
    !instructions.some(instruction => instruction.workflow_block_id === block.id)
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Custom Processing Instructions</h3>
        <p className="text-sm text-gray-500 mt-1">
          Add block-specific instructions to customize AI analysis. These instructions will be applied 
          only to the selected workflow blocks when reprocessing this task.
        </p>
      </div>

      {/* Existing Instructions */}
      {instructions.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-md font-medium text-gray-900">Current Instructions</h4>
          {instructions.map((instruction) => (
            <div key={instruction.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {instruction.workflow_block_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(instruction.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {editingId === instruction.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        rows={3}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleUpdateInstruction(instruction.id)}
                          disabled={updateMutation.isPending}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          <CheckIcon className="h-4 w-4 mr-1" />
                          Save
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                          <XMarkIcon className="h-4 w-4 mr-1" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-900">{instruction.instruction_text}</p>
                  )}
                </div>
                
                {editingId !== instruction.id && (
                  <div className="flex space-x-2 ml-4">
                    <button
                      onClick={() => startEditing(instruction)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteInstruction(instruction.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-400 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Instruction */}
      {availableBlocks.length > 0 && (
        <div>
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Block Instruction
            </button>
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h4 className="text-md font-medium text-gray-900">Add New Instruction</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Workflow Block
                </label>
                <select
                  value={selectedBlockId || ''}
                  onChange={(e) => setSelectedBlockId(Number(e.target.value))}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">Select a workflow block...</option>
                  {availableBlocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Instructions
                </label>
                <textarea
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  rows={4}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Enter specific instructions for this workflow block..."
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleAddInstruction}
                  disabled={!newInstruction.trim() || !selectedBlockId || createMutation.isPending}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Adding...' : 'Add Instruction'}
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setNewInstruction('')
                    setSelectedBlockId(null)
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reprocess Button */}
      {instructions.length > 0 && (
        <div className="border-t border-gray-200 pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-md font-medium text-gray-900">Reprocess with Instructions</h4>
              <p className="text-sm text-gray-500">
                Apply all custom instructions and regenerate the AI analysis.
              </p>
            </div>
            <button
              onClick={handleReprocess}
              disabled={processRequest.isPending}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {processRequest.isPending ? 'Processing...' : 'Reprocess Task'}
            </button>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {processRequest.isError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">
            Failed to reprocess request. Please try again.
          </div>
        </div>
      )}

      {processRequest.isSuccess && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-700">
            Reprocessing started successfully. Results will appear in the AI Analysis tab when complete.
          </div>
        </div>
      )}

      {availableBlocks.length === 0 && instructions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No workflow blocks available for custom instructions.</p>
        </div>
      )}
    </div>
  )
}