import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { 
  PlusIcon, 
  TrashIcon, 
  ArrowUpIcon, 
  ArrowDownIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { Workflow, CreateWorkflowRequest, CreateWorkflowBlockRequest, DashboardConfig } from '../types/workflow'
import { WorkflowBlockEditor } from './WorkflowBlockEditor'
import { SchemaEditor } from './SchemaEditor'
import { DashboardBuilder } from './DashboardBuilder'
import { dashboardClient } from '../api/dashboardClient'

interface WorkflowEditorProps {
  workflow?: Workflow | null
  onSave: (workflow: CreateWorkflowRequest) => void
  onCancel: () => void
  isLoading?: boolean
}

export const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  workflow,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'ACTIVE' | 'ARCHIVED'>('DRAFT')
  const [isDefault, setIsDefault] = useState(false)
  const [blocks, setBlocks] = useState<CreateWorkflowBlockRequest[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig>({
    workflow_id: 0,
    fields: [],
    layout: 'grid'
  })

  useEffect(() => {
    if (workflow) {
      setName(workflow.name)
      setDescription(workflow.description || '')
      setStatus(workflow.status)
      setIsDefault(workflow.is_default)
      
      // Create a mapping from database block IDs to array indices
      const blockIdToIndex = new Map<number, number>()
      workflow.blocks.forEach((block, index) => {
        blockIdToIndex.set(block.id, index)
      })
      
      setBlocks(workflow.blocks.map(block => ({
        name: block.name,
        prompt: block.prompt,
        order: block.order,
        block_type: block.block_type,
        output_schema: block.output_schema,
        inputs: block.inputs.map(input => ({
          input_type: input.input_type,
          source_block_id: input.source_block_id ? blockIdToIndex.get(input.source_block_id) : undefined,
          variable_name: input.variable_name
        }))
      })))

      // Load dashboard config
      const loadDashboardConfig = async () => {
        try {
          const config = await dashboardClient.getDashboardConfig(workflow.id)
          setDashboardConfig(config)
        } catch (error) {
          console.error('Failed to load dashboard config:', error)
          // Fallback to empty config
          setDashboardConfig({
            workflow_id: workflow.id,
            fields: [],
            layout: 'grid'
          })
        }
      }
      
      loadDashboardConfig()
    }
  }, [workflow])

  const addBlock = () => {
    console.log('Adding new block, current blocks count:', blocks.length)
    const newBlock: CreateWorkflowBlockRequest = {
      name: `Block ${blocks.length + 1}`,
      prompt: '',
      order: blocks.length,
      block_type: 'CUSTOM',
      output_schema: undefined,
      inputs: []
    }
    setBlocks([...blocks, newBlock])
    console.log('New block added, total blocks:', blocks.length + 1)
  }

  const updateBlock = (index: number, updatedBlock: CreateWorkflowBlockRequest) => {
    console.log('WorkflowEditor updateBlock:', {
      index,
      updatedBlock,
      currentBlocks: blocks.length,
      blockName: updatedBlock.name
    })
    const newBlocks = [...blocks]
    newBlocks[index] = updatedBlock
    setBlocks(newBlocks)
  }

  const deleteBlock = (index: number) => {
    const blockToDelete = blocks[index]
    
    // Prevent deletion of CORE blocks
    if (blockToDelete.block_type === 'CORE') {
      setErrors({
        ...errors,
        [`block_${index}`]: 'Core blocks cannot be deleted, but they can be edited.'
      })
      return
    }
    
    const newBlocks = blocks.filter((_, i) => i !== index)
    // Update order for remaining blocks
    const reorderedBlocks = newBlocks.map((block, i) => ({
      ...block,
      order: i
    }))
    setBlocks(reorderedBlocks)
    
    // Clear any errors for this block
    const newErrors = { ...errors }
    delete newErrors[`block_${index}`]
    setErrors(newErrors)
  }

  const moveBlock = (fromIndex: number, toIndex: number) => {
    const newBlocks = [...blocks]
    const [movedBlock] = newBlocks.splice(fromIndex, 1)
    newBlocks.splice(toIndex, 0, movedBlock)
    
    // Update order for all blocks
    const reorderedBlocks = newBlocks.map((block, i) => ({
      ...block,
      order: i
    }))
    setBlocks(reorderedBlocks)
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return
    
    const sourceIndex = result.source.index
    const destIndex = result.destination.index
    
    if (sourceIndex !== destIndex) {
      moveBlock(sourceIndex, destIndex)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (!name.trim()) {
      newErrors.name = 'Workflow name is required'
    }
    
    blocks.forEach((block, index) => {
      if (!block.name.trim()) {
        newErrors[`block_${index}_name`] = 'Block name is required'
      }
      if (!block.prompt.trim()) {
        newErrors[`block_${index}_prompt`] = 'Block prompt is required'
      }
      
      // Validate inputs
      block.inputs.forEach((input, inputIndex) => {
        if (!input.variable_name.trim()) {
          newErrors[`block_${index}_input_${inputIndex}_variable`] = 'Variable name is required'
        }
        if (input.input_type === 'BLOCK_OUTPUT' && (input.source_block_id === undefined || input.source_block_id === null)) {
          newErrors[`block_${index}_input_${inputIndex}_source`] = 'Source block is required'
        }
      })
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    
    console.log('handleSave - starting save process')
    console.log('Current workflow:', workflow)
    console.log('Current blocks:', blocks)
    
    // For existing workflows, the backend will handle converting array indices to database IDs
    const processedBlocks = blocks
    
    console.log('Processed blocks:', processedBlocks)
    
    const workflowData: CreateWorkflowRequest = {
      name: name.trim(),
      description: description.trim() || undefined,
      status,
      is_default: isDefault,
      blocks: processedBlocks
    }
    
    console.log('Final workflow data being saved:', workflowData)
    
    // Save the workflow first
    try {
      onSave(workflowData)
      console.log('onSave called successfully')
    } catch (error) {
      console.error('Error calling onSave:', error)
    }
    
    // Then save the dashboard configuration if workflow exists
    if (workflow && dashboardConfig.fields.length > 0) {
      try {
        await dashboardClient.saveDashboardConfig(workflow.id, dashboardConfig)
      } catch (error) {
        console.error('Failed to save dashboard config:', error)
        // Don't block workflow save, just log the error
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          {workflow ? 'Edit Workflow' : 'Create New Workflow'}
        </h2>
        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Workflow'}
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Workflow Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${
                errors.name ? 'border-red-300' : ''
              }`}
              placeholder="Enter workflow name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Optional description of the workflow"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'ACTIVE' | 'ARCHIVED')}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            
            <div className="flex items-center">
              <div className="flex items-center h-5">
                <input
                  id="isDefault"
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="isDefault" className="font-medium text-gray-700">
                  Set as default workflow
                </label>
                <p className="text-gray-500">This workflow will be used for new requests by default</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blocks */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Workflow Blocks</h3>
          <button
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Add Block button clicked')
              addBlock()
            }}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer"
            type="button"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Block
          </button>
        </div>

        {blocks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No blocks yet. Add your first block to get started.</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="blocks">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                  {blocks.map((block, index) => (
                    <Draggable key={`block-${index}`} draggableId={`block-${index}`} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <WorkflowBlockEditor
                            block={block}
                            blockIndex={index}
                            availableBlocks={blocks.slice(0, index)}
                            onUpdate={(updatedBlock) => updateBlock(index, updatedBlock)}
                            onDelete={() => deleteBlock(index)}
                            errors={errors}
                            dragHandleProps={provided.dragHandleProps}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>

      {/* Dashboard Builder */}
      <DashboardBuilder
        blocks={blocks}
        dashboardConfig={dashboardConfig}
        onConfigChange={setDashboardConfig}
      />
    </div>
  )
}