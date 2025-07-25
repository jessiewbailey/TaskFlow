import React, { useState, Fragment, useEffect, useRef } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import { XMarkIcon, PencilIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { format } from 'date-fns'
import type { Task, RequestStatus } from '../types'
import { DashboardConfig } from '../types/workflow'
import { CustomInstructions } from './CustomInstructions'
import { ConfirmationDialog } from './ConfirmationDialog'
import { useUpdateRequest, useDeleteRequest } from '../hooks/useRequests'
import { dashboardClient } from '../api/dashboardClient'
import { DashboardRenderer } from './DashboardRenderer'

interface RequestDrawerProps {
  request: Task | null
  isOpen: boolean
  onClose: () => void
  onRequestUpdated?: () => void
  onRequestDeleted?: () => void
}

export const RequestDrawer: React.FC<RequestDrawerProps> = ({
  request,
  isOpen,
  onClose,
  onRequestUpdated,
  onRequestDeleted
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editedRequest, setEditedRequest] = useState<Partial<Task>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false)
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null)
  const [workflowData, setWorkflowData] = useState<any>(null)
  const [similarTasks, setSimilarTasks] = useState<any[]>([])
  const [isSearchingSimilar, setIsSearchingSimilar] = useState(false)
  const [drawerWidth, setDrawerWidth] = useState(() => {
    // Default to 50% of window width, with fallback to 672px if window is not available
    return typeof window !== 'undefined' ? Math.max(400, window.innerWidth * 0.5) : 672
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef<HTMLDivElement>(null)
  
  const updateRequest = useUpdateRequest()
  const deleteRequest = useDeleteRequest()

  // Search for similar tasks
  const searchSimilarTasks = async () => {
    if (!request) return
    
    setIsSearchingSimilar(true)
    
    try {
      // Get settings from localStorage
      const limit = parseInt(localStorage.getItem('similaritySearchLimit') || '5', 10)
      const threshold = parseFloat(localStorage.getItem('similarityThreshold') || '0')
      const restrictToExercise = localStorage.getItem('restrictToSameExercise') === 'true'
      
      const response = await fetch(`/api/requests/${request.id}/similar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          limit,
          threshold,
          restrict_to_exercise: restrictToExercise
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setSimilarTasks(data.similar_tasks || [])
      } else {
        console.error('Failed to search similar tasks')
        setSimilarTasks([])
      }
    } catch (error) {
      console.error('Error searching similar tasks:', error)
      setSimilarTasks([])
    } finally {
      setIsSearchingSimilar(false)
    }
  }

  // Load similar tasks when request changes
  useEffect(() => {
    if (request) {
      setSimilarTasks([])
      searchSimilarTasks()
    }
  }, [request?.id])

  // Load dashboard configuration and workflow data when request changes
  useEffect(() => {
    const loadWorkflowData = async () => {
      if (request && request.workflow_id) {
        try {
          // Load dashboard config
          const config = await dashboardClient.getDashboardConfig(request.workflow_id)
          setDashboardConfig(config)
          
          // Load workflow data (including blocks)
          const response = await fetch(`/api/workflows/${request.workflow_id}`)
          if (response.ok) {
            const workflowData = await response.json()
            setWorkflowData(workflowData)
          }
        } catch (error) {
          console.error('Failed to load workflow data:', error)
          setDashboardConfig(null)
          setWorkflowData(null)
        }
      } else {
        setDashboardConfig(null)
        setWorkflowData(null)
      }
    }
    
    loadWorkflowData()
  }, [request])

  // Transform AI output data to match dashboard renderer expectations
  const transformAIOutputData = (aiOutput: any) => {
    if (!aiOutput) return null

    // Parse the summary field if it's a JSON string (from workflow execution)
    let summaryData = aiOutput.summary
    
    if (typeof summaryData === 'string') {
      try {
        summaryData = JSON.parse(summaryData)
      } catch (e) {
        // If it's not JSON, treat as plain string
        summaryData = { summary: summaryData }
      }
    }

    // Map both legacy (hardcoded pipeline) and new (workflow) AI output structures
    const isWorkflowOutput = summaryData && typeof summaryData === 'object' && !Array.isArray(summaryData)
    
    if (isWorkflowOutput) {
      // New workflow-based output structure
      // The AI output data is stored with block names as keys in the summary field
      return summaryData
    } else {
      // Legacy hardcoded pipeline structure (for backward compatibility)
      return {
        'Extract Metadata': {
          word_count: aiOutput.word_count || 0,
          estimated_processing_time: aiOutput.estimated_processing_time || 0,
          document_type: aiOutput.document_type || "Document Request",
          urgency_level: aiOutput.urgency_level || "MEDIUM"
        },
        'Classify Topic': {
          primary_topic: aiOutput.topic || "Unknown",
          secondary_topics: aiOutput.secondary_topics || [],
          confidence_score: aiOutput.topic_confidence || 0.5
        },
        'Summarize Content': {
          executive_summary: typeof summaryData === 'string' ? summaryData : "No summary available",
          key_points: aiOutput.key_points || [],
          requested_records: aiOutput.requested_records || []
        },
        'Assess Sensitivity': {
          score: aiOutput.sensitivity_score || 0,
          risk_factors: aiOutput.risk_factors || [],
          explanation: aiOutput.sensitivity_explanation || "No explanation available"
        },
        'Suggest Actions': aiOutput.redactions_json || []
      }
    }
  }
  
  if (!request) return null
  
  const handleEdit = () => {
    setIsEditing(true)
    setEditedRequest({
      text: request.text,
      requester: request.requester,
      status: request.status,
      assigned_analyst_id: request.assigned_analyst_id,
      due_date: request.due_date
    })
  }
  
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedRequest({})
  }
  
  const handleSaveEdit = () => {
    // Basic validation
    if (!editedRequest.text || editedRequest.text.trim().length < 10) {
      alert('Request text must be at least 10 characters long')
      return
    }
    
    // Filter out empty/unchanged values
    const filteredRequest = Object.fromEntries(
      Object.entries(editedRequest).filter(([_, value]) => 
        value !== undefined && value !== null && value !== ''
      )
    )
    
    // Only update if there are actual changes
    if (Object.keys(filteredRequest).length === 0) {
      setIsEditing(false)
      return
    }
    
    setShowUpdateConfirm(true)
  }
  
  const confirmUpdate = async () => {
    try {
      // Filter out empty/unchanged values
      const filteredRequest = Object.fromEntries(
        Object.entries(editedRequest).filter(([_, value]) => 
          value !== undefined && value !== null && value !== ''
        )
      )
      
      await updateRequest.mutateAsync({
        id: request.id,
        payload: filteredRequest
      })
      setIsEditing(false)
      setEditedRequest({})
      setShowUpdateConfirm(false)
      onRequestUpdated?.()
    } catch (error) {
      console.error('Failed to update request:', error)
      alert('Failed to update request. Please try again.')
    }
  }
  
  const confirmDelete = async () => {
    try {
      await deleteRequest.mutateAsync(request.id)
      setShowDeleteConfirm(false)
      onRequestDeleted?.()
      onClose()
    } catch (error) {
      console.error('Failed to delete request:', error)
    }
  }
  
  const handleFieldChange = (field: string, value: any) => {
    setEditedRequest(prev => ({ ...prev, [field]: value }))
  }
  
  const handleAnalystChange = (value: string) => {
    const analystId = value === '' ? null : parseInt(value)
    setEditedRequest(prev => ({ ...prev, assigned_analyst_id: analystId }))
  }

  // Resize functionality
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    
    const startX = e.clientX
    const startWidth = drawerWidth
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startX - e.clientX // Moving left increases width  
      const newWidth = Math.max(400, Math.min(window.innerWidth - 100, startWidth + deltaX))
      console.log('Drag debug:', { startX, clientX: e.clientX, deltaX, startWidth, newWidth })
      setDrawerWidth(newWidth)
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <div className="fixed inset-0" />

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel 
                  className="pointer-events-auto relative flex"
                  style={{ width: `${drawerWidth}px` }}
                >
                  {/* Resize Handle */}
                  <div
                    onMouseDown={handleResizeStart}
                    className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500 ${
                      isResizing ? 'bg-indigo-500' : 'bg-transparent hover:bg-indigo-300'
                    } transition-colors z-10`}
                    style={{ marginLeft: '-2px' }}
                  />
                  
                  <div className={`flex h-full flex-col overflow-y-scroll bg-white shadow-xl w-full ${
                    isResizing ? 'select-none' : ''
                  }`}>
                    {/* Header */}
                    <div className="bg-indigo-700 px-4 py-6 sm:px-6">
                      <div className="flex items-center justify-between">
                        <Dialog.Title className="text-base font-semibold leading-6 text-white">
                          Task #{request.id}
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center space-x-2">
                          {!isEditing && (
                            <>
                              <button
                                type="button"
                                className="rounded-md bg-indigo-700 text-indigo-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                                onClick={handleEdit}
                                title="Edit request"
                              >
                                <span className="sr-only">Edit request</span>
                                <PencilIcon className="h-5 w-5" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="rounded-md bg-red-600 text-red-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                                onClick={() => setShowDeleteConfirm(true)}
                                title="Delete request"
                              >
                                <span className="sr-only">Delete request</span>
                                <TrashIcon className="h-5 w-5" aria-hidden="true" />
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            className="rounded-md bg-indigo-700 text-indigo-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                            onClick={onClose}
                          >
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1">
                        <p className="text-sm text-indigo-300">
                          Received {format(new Date(request.date_received), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <Tab.Group>
                        <div className="border-b border-gray-200">
                          <Tab.List className="flex space-x-8 px-6">
                            <Tab
                              className={({ selected }) =>
                                clsx(
                                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
                                  selected
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                )
                              }
                            >
                              Original Text
                            </Tab>
                            <Tab
                              className={({ selected }) =>
                                clsx(
                                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
                                  selected
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                )
                              }
                            >
                              AI Analysis
                            </Tab>
                            <Tab
                              className={({ selected }) =>
                                clsx(
                                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
                                  selected
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                )
                              }
                            >
                              Custom Processing
                            </Tab>
                            <Tab
                              className={({ selected }) =>
                                clsx(
                                  'whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium',
                                  selected
                                    ? 'border-indigo-500 text-indigo-600'
                                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                )
                              }
                            >
                              Similar Tasks ({similarTasks.length})
                            </Tab>
                          </Tab.List>
                        </div>

                        <Tab.Panels className="flex-1">
                          {/* Original Text Tab */}
                          <Tab.Panel className="p-6">
                            <div className="space-y-6">
                              <div>
                                <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-medium text-gray-900">Task Details</h3>
                                  {isEditing && (
                                    <div className="flex space-x-2">
                                      <button
                                        type="button"
                                        onClick={handleSaveEdit}
                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                      >
                                        Save Changes
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                  <div>
                                    <dt className="text-sm font-medium text-gray-500">Requester</dt>
                                    <dd className="mt-1 text-sm text-gray-900">
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={editedRequest.requester || ''}
                                          onChange={(e) => handleFieldChange('requester', e.target.value)}
                                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                          placeholder="Anonymous"
                                        />
                                      ) : (
                                        request.requester || 'Anonymous'
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                                    <dd className="mt-1 text-sm text-gray-900">
                                      {isEditing ? (
                                        <select
                                          value={editedRequest.status || request.status}
                                          onChange={(e) => handleFieldChange('status', e.target.value as RequestStatus)}
                                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                        >
                                          <option value="NEW">New</option>
                                          <option value="IN_REVIEW">In Review</option>
                                          <option value="PENDING">Pending</option>
                                          <option value="CLOSED">Closed</option>
                                        </select>
                                      ) : (
                                        request.status.replace('_', ' ')
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-sm font-medium text-gray-500">Assigned Analyst</dt>
                                    <dd className="mt-1 text-sm text-gray-900">
                                      {isEditing ? (
                                        <select
                                          value={editedRequest.assigned_analyst_id || ''}
                                          onChange={(e) => handleAnalystChange(e.target.value)}
                                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                        >
                                          <option value="">Unassigned</option>
                                          <option value="1">System Admin</option>
                                          <option value="2">Jane Analyst</option>
                                          <option value="3">John Supervisor</option>
                                        </select>
                                      ) : (
                                        request.assigned_analyst?.name || 'Unassigned'
                                      )}
                                    </dd>
                                  </div>
                                  <div>
                                    <dt className="text-sm font-medium text-gray-500">Due Date</dt>
                                    <dd className="mt-1 text-sm text-gray-900">
                                      {isEditing ? (
                                        <input
                                          type="date"
                                          value={editedRequest.due_date ? editedRequest.due_date.split('T')[0] : ''}
                                          onChange={(e) => handleFieldChange('due_date', e.target.value)}
                                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                        />
                                      ) : (
                                        request.due_date ? format(new Date(request.due_date), 'MMM d, yyyy') : 'Not set'
                                      )}
                                    </dd>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Task Description</h4>
                                <div className="bg-gray-50 p-4 rounded-md">
                                  {isEditing ? (
                                    <textarea
                                      value={editedRequest.text || ''}
                                      onChange={(e) => handleFieldChange('text', e.target.value)}
                                      rows={8}
                                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                      placeholder="Enter task description..."
                                    />
                                  ) : (
                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                      {request.text}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Tab.Panel>

                          {/* AI Analysis Tab */}
                          <Tab.Panel className="p-6">
                            {request.latest_ai_output ? (
                              <div className="space-y-6">
                                <div>
                                  <h3 className="text-lg font-medium text-gray-900">
                                    Processing Results (Version {request.latest_ai_output.version})
                                  </h3>
                                  <p className="text-sm text-gray-500">
                                    Generated {format(new Date(request.latest_ai_output.created_at), 'MMM d, yyyy h:mm a')}
                                  </p>
                                </div>


                                {dashboardConfig && dashboardConfig.fields.length > 0 ? (
                                  <DashboardRenderer 
                                    config={dashboardConfig} 
                                    data={transformAIOutputData(request.latest_ai_output)}
                                    requestId={request.id}
                                    workflowBlocks={workflowData?.blocks}
                                  />
                                ) : (
                                  <div className="space-y-4">
                                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                                      <p className="text-gray-500 mb-2">No dashboard configuration found</p>
                                      <p className="text-sm text-gray-400">
                                        Configure the AI Analysis dashboard in the workflow editor to customize this view
                                      </p>
                                    </div>
                                    
                                    {/* Fallback to basic display */}
                                    {request.latest_ai_output.topic && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">Topic</h4>
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                          {request.latest_ai_output.topic}
                                        </span>
                                      </div>
                                    )}

                                    {request.latest_ai_output.sensitivity_score !== undefined && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">Sensitivity Score</h4>
                                        <div className="flex items-center">
                                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-4">
                                            <div
                                              className="bg-red-600 h-2 rounded-full"
                                              style={{ width: `${request.latest_ai_output.sensitivity_score * 100}%` }}
                                            />
                                          </div>
                                          <span className="text-sm font-medium text-gray-900">
                                            {(request.latest_ai_output.sensitivity_score * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                    {request.latest_ai_output.summary && (
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-900 mb-2">Summary</h4>
                                        <div className="bg-gray-50 p-4 rounded-md">
                                          <p className="text-sm text-gray-900">
                                            {typeof request.latest_ai_output.summary === 'string' 
                                              ? request.latest_ai_output.summary 
                                              : JSON.stringify(request.latest_ai_output.summary, null, 2)
                                            }
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center py-8">
                                <p className="text-gray-500">No AI analysis available yet</p>
                              </div>
                            )}
                          </Tab.Panel>

                          {/* Custom Processing Tab */}
                          <Tab.Panel className="p-6">
                            <CustomInstructions 
                              requestId={request.id} 
                              workflowBlocks={workflowData?.blocks || []}
                            />
                          </Tab.Panel>

                          {/* Similar Tasks Tab */}
                          <Tab.Panel className="p-6">
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-medium text-gray-900">Similar Tasks</h3>
                                  <button
                                    type="button"
                                    onClick={searchSimilarTasks}
                                    disabled={isSearchingSimilar}
                                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                  >
                                    {isSearchingSimilar ? 'Searching...' : 'Refresh'}
                                  </button>
                                </div>

                                {isSearchingSimilar ? (
                                  <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                  </div>
                                ) : similarTasks.length > 0 ? (
                                  <div className="space-y-3">
                                    {similarTasks.map((task) => (
                                      <div
                                        key={task.task_id}
                                        className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                                      >
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                              <h4 className="text-sm font-medium text-gray-900">
                                                Task #{task.task_id}
                                              </h4>
                                              <span className="text-xs text-gray-500">
                                                {(task.score * 100).toFixed(1)}% similarity
                                              </span>
                                            </div>
                                            <p className="mt-1 text-sm text-gray-600 line-clamp-3">
                                              {task.description}
                                            </p>
                                            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                                              <span>Status: {task.status}</span>
                                              {task.priority && <span>Priority: {task.priority}</span>}
                                              {task.created_at && (
                                                <span>Created: {new Date(task.created_at).toLocaleDateString()}</span>
                                              )}
                                            </div>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              // Close current drawer
                                              onClose()
                                              // Small delay to ensure drawer closes before navigating
                                              setTimeout(() => {
                                                // Navigate to the similar task
                                                window.location.href = `/?task=${task.task_id}`
                                              }, 100)
                                            }}
                                            className="ml-4 text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                                          >
                                            View
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-gray-500">
                                    No similar tasks found.
                                  </div>
                                )}

                                <div className="mt-4 text-xs text-gray-500">
                                  <p>
                                    Showing top {similarTasks.length} similar tasks. 
                                    You can adjust the number of results in{' '}
                                    <a href="/settings/similarity-search" className="text-indigo-600 hover:text-indigo-500">
                                      Settings → Similarity Search
                                    </a>
                                  </p>
                                </div>
                              </div>
                            </Tab.Panel>
                        </Tab.Panels>
                      </Tab.Group>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
        
        {/* Confirmation Dialogs */}
        <ConfirmationDialog
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
          title="Delete Task"
          message={`Are you sure you want to delete Task #${request.id}? This action cannot be undone and will remove all associated data including AI analysis.`}
          confirmText="Delete"
          type="danger"
        />
        
        <ConfirmationDialog
          isOpen={showUpdateConfirm}
          onClose={() => setShowUpdateConfirm(false)}
          onConfirm={confirmUpdate}
          title="Update Task"
          message={`Are you sure you want to save these changes to Task #${request.id}?`}
          confirmText="Save Changes"
          type="info"
        />
      </Dialog>
    </Transition.Root>
  )
}
