import React, { useState, useRef } from 'react'
import { PlusIcon, PencilIcon, TrashIcon, PlayIcon, StarIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { Settings } from './Settings'
import { WorkflowEditor } from '../components/WorkflowEditor'
import { useWorkflows, useCreateWorkflow, useUpdateWorkflow, useDeleteWorkflow } from '../hooks/useWorkflows'
import { Workflow, CreateWorkflowRequest } from '../types/workflow'
import { dashboardClient } from '../api/dashboardClient'

export const WorkflowSettings: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false)
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: workflowsData, isLoading, error } = useWorkflows()
  const createWorkflow = useCreateWorkflow()
  const updateWorkflow = useUpdateWorkflow()
  const deleteWorkflow = useDeleteWorkflow()

  const handleCreateWorkflow = () => {
    setEditingWorkflow(null)
    setIsEditing(true)
  }

  const handleEditWorkflow = (workflow: Workflow) => {
    setEditingWorkflow(workflow)
    setIsEditing(true)
  }

  const handleSaveWorkflow = async (workflowData: CreateWorkflowRequest) => {
    try {
      if (editingWorkflow) {
        await updateWorkflow.mutateAsync({
          id: editingWorkflow.id,
          workflow: workflowData
        })
      } else {
        await createWorkflow.mutateAsync(workflowData)
      }
      setIsEditing(false)
      setEditingWorkflow(null)
    } catch (error) {
      console.error('Failed to save workflow:', error)
    }
  }

  const handleDeleteWorkflow = async (id: number) => {
    try {
      await deleteWorkflow.mutateAsync(id)
      setShowDeleteConfirm(null)
    } catch (error) {
      console.error('Failed to delete workflow:', error)
    }
  }

  const handleSetDefault = async (workflow: Workflow) => {
    try {
      await updateWorkflow.mutateAsync({
        id: workflow.id,
        workflow: {
          is_default: true
        }
      })
    } catch (error) {
      console.error('Failed to set default workflow:', error)
    }
  }

  const handleStatusChange = async (workflow: Workflow, newStatus: 'DRAFT' | 'ACTIVE' | 'ARCHIVED') => {
    try {
      await updateWorkflow.mutateAsync({
        id: workflow.id,
        workflow: {
          status: newStatus
        }
      })
    } catch (error) {
      console.error('Failed to update workflow status:', error)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditingWorkflow(null)
  }

  const handleDownloadWorkflow = async (workflow: Workflow) => {
    try {
      // Fetch dashboard configuration for this workflow
      let dashboardConfig = null
      try {
        dashboardConfig = await dashboardClient.getDashboardConfig(workflow.id)
        // Remove workflow_id and timestamps from export
        if (dashboardConfig && dashboardConfig.fields && dashboardConfig.fields.length > 0) {
          dashboardConfig = {
            layout: dashboardConfig.layout,
            fields: dashboardConfig.fields.map(field => ({
              id: field.id,
              block_name: field.block_name,
              field_path: field.field_path,
              display_type: field.display_type,
              label: field.label,
              order: field.order,
              width: field.width,
              visible: field.visible
            }))
          }
        } else {
          dashboardConfig = null
        }
      } catch (error) {
        console.warn('Failed to fetch dashboard config for export:', error)
        dashboardConfig = null
      }

      // Create a clean export format without internal IDs and timestamps
      const exportData = {
        name: workflow.name,
        description: workflow.description,
        status: workflow.status,
        blocks: workflow.blocks.map(block => ({
          name: block.name,
          prompt: block.prompt,
          order: block.order,
          block_type: block.block_type,
          output_schema: block.output_schema,
          model_name: block.model_name,
          inputs: block.inputs.map(input => ({
            input_type: input.input_type,
            variable_name: input.variable_name,
            // Map source_block_id to source_block_name for readability
            source_block_name: input.source_block_id 
              ? workflow.blocks.find(b => b.id === input.source_block_id)?.name
              : undefined
          }))
        })),
        // Include dashboard configuration if it exists
        dashboard_config: dashboardConfig
      }

      const dataStr = JSON.stringify(exportData, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
      
      const exportFileDefaultName = `workflow-${workflow.name.toLowerCase().replace(/\s+/g, '-')}.json`
      
      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()
    } catch (error) {
      console.error('Failed to export workflow:', error)
      alert('Failed to export workflow. Please try again.')
    }
  }

  const handleUploadWorkflow = () => {
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    try {
      const text = await file.text()
      const workflowData = JSON.parse(text)
      
      // Validate the imported data structure
      if (!workflowData.name || !workflowData.blocks || !Array.isArray(workflowData.blocks)) {
        throw new Error('Invalid workflow format. Please ensure the file contains a valid workflow export.')
      }

      // Convert the imported data to the format expected by the API
      const importRequest: CreateWorkflowRequest = {
        name: `${workflowData.name} (imported)`,
        description: workflowData.description,
        status: 'DRAFT', // Always import as draft for safety
        blocks: workflowData.blocks.map((block: any, index: number) => {
          // Find source block IDs by name for inputs
          const inputs = block.inputs?.map((input: any) => {
            let source_block_id: number | undefined = undefined
            
            if (input.source_block_name && input.input_type === 'BLOCK_OUTPUT') {
              // Find the source block by name in the current workflow blocks
              const sourceBlockIndex = workflowData.blocks.findIndex((b: any) => b.name === input.source_block_name)
              if (sourceBlockIndex !== -1) {
                // Use temporary indices that will be resolved after creation
                source_block_id = sourceBlockIndex
              }
            }

            return {
              input_type: input.input_type,
              variable_name: input.variable_name,
              source_block_id
            }
          }) || []

          return {
            name: block.name,
            prompt: block.prompt,
            order: block.order || index + 1,
            block_type: block.block_type || 'CUSTOM',
            output_schema: block.output_schema,
            model_name: block.model_name || 'gemma3:1b',
            inputs
          }
        })
      }

      const createdWorkflow = await createWorkflow.mutateAsync(importRequest)
      
      // Import dashboard configuration if it exists in the file
      if (workflowData.dashboard_config && createdWorkflow && createdWorkflow.id) {
        try {
          const dashboardConfig = {
            workflow_id: createdWorkflow.id,
            layout: workflowData.dashboard_config.layout || 'grid',
            fields: workflowData.dashboard_config.fields || []
          }
          
          if (dashboardConfig.fields.length > 0) {
            await dashboardClient.saveDashboardConfig(createdWorkflow.id, dashboardConfig)
            console.log('Dashboard configuration imported successfully')
          }
        } catch (dashboardError) {
          console.warn('Failed to import dashboard configuration:', dashboardError)
          // Don't fail the entire import if dashboard config fails
        }
      }
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
    } catch (error) {
      console.error('Failed to import workflow:', error)
      alert(`Failed to import workflow: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsImporting(false)
    }
  }

  if (isEditing) {
    return (
      <Settings>
        <WorkflowEditor
          workflow={editingWorkflow}
          onSave={handleSaveWorkflow}
          onCancel={handleCancelEdit}
          isLoading={createWorkflow.isPending || updateWorkflow.isPending}
        />
      </Settings>
    )
  }

  return (
    <Settings>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">AI Workflows</h2>
            <p className="text-sm text-gray-500">
              Manage AI processing workflows for document requests
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleUploadWorkflow}
              disabled={isImporting}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              {isImporting ? 'Importing...' : 'Import Workflow'}
            </button>
            <button
              onClick={handleCreateWorkflow}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Workflow
            </button>
          </div>
        </div>

        {/* Hidden file input for workflow import */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading workflows...</p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">
              Failed to load workflows. Please try again.
            </div>
          </div>
        )}

        {workflowsData && workflowsData.workflows.length === 0 && (
          <div className="text-center py-8">
            <PlayIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No workflows</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first AI workflow.
            </p>
            <div className="mt-6">
              <button
                onClick={handleCreateWorkflow}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Workflow
              </button>
            </div>
          </div>
        )}

        {workflowsData && workflowsData.workflows.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {workflowsData.workflows.map((workflow) => (
                <li key={workflow.id}>
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <PlayIcon className="h-6 w-6 text-gray-400" />
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {workflow.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {workflow.description || 'No description'}
                          </p>
                          <div className="flex items-center mt-1 space-x-2">
                            {workflow.is_default && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <StarIconSolid className="h-3 w-3 mr-1" />
                                Default
                              </span>
                            )}
                            <select
                              value={workflow.status}
                              onChange={(e) => handleStatusChange(workflow, e.target.value as 'DRAFT' | 'ACTIVE' | 'ARCHIVED')}
                              className={`text-xs px-2 py-0.5 rounded border-0 font-medium ${
                                workflow.status === 'ACTIVE' 
                                  ? 'bg-green-100 text-green-800'
                                  : workflow.status === 'DRAFT'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                              disabled={updateWorkflow.isPending}
                            >
                              <option value="DRAFT">DRAFT</option>
                              <option value="ACTIVE">ACTIVE</option>
                              <option value="ARCHIVED">ARCHIVED</option>
                            </select>
                            <span className="text-xs text-gray-500">
                              {workflow.blocks.length} blocks
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDownloadWorkflow(workflow)}
                        className="inline-flex items-center p-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        title="Download workflow as JSON"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      {!workflow.is_default && (
                        <button
                          onClick={() => handleSetDefault(workflow)}
                          disabled={updateWorkflow.isPending}
                          className="inline-flex items-center p-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                          title="Set as default workflow"
                        >
                          <StarIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEditWorkflow(workflow)}
                        className="inline-flex items-center p-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        title="Edit workflow"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(workflow.id)}
                        disabled={workflow.is_default}
                        className="inline-flex items-center p-2 border border-gray-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50 disabled:text-gray-400"
                        title={workflow.is_default ? "Cannot delete default workflow" : "Delete workflow"}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <TrashIcon className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete Workflow
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this workflow? This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    onClick={() => handleDeleteWorkflow(showDeleteConfirm)}
                    disabled={deleteWorkflow.isPending}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {deleteWorkflow.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(null)}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Settings>
  )
}