import React, { useState, useEffect } from 'react'
import { PlayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface Workflow {
  id: number
  name: string
  description: string
  status: string
  is_default: boolean
}

interface RerunResult {
  success: boolean
  totalTasks: number
  successCount: number
  errors: Array<{
    taskId: number
    message: string
  }>
}

export const RerunTasks: React.FC = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null)
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true)
  const [isRerunning, setIsRerunning] = useState(false)
  const [rerunResult, setRerunResult] = useState<RerunResult | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const response = await fetch('/api/workflows')
        const data = await response.json()
        setWorkflows(data.workflows || [])
      } catch (error) {
        console.error('Failed to fetch workflows:', error)
      } finally {
        setIsLoadingWorkflows(false)
      }
    }

    fetchWorkflows()
  }, [])

  const handleRerunAll = async () => {
    if (!selectedWorkflowId) return

    setIsRerunning(true)
    setRerunResult(null)
    setShowConfirmation(false)

    try {
      const response = await fetch('/api/requests/bulk-rerun', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflow_id: selectedWorkflowId
        }),
      })

      if (!response.ok) {
        throw new Error(`Rerun failed: ${response.statusText}`)
      }

      const result = await response.json()
      setRerunResult(result)
    } catch (error) {
      console.error('Rerun error:', error)
      setRerunResult({
        success: false,
        totalTasks: 0,
        successCount: 0,
        errors: [{ taskId: 0, message: error instanceof Error ? error.message : 'Rerun failed' }]
      })
    } finally {
      setIsRerunning(false)
    }
  }

  const selectedWorkflow = workflows.find(w => w.id === selectedWorkflowId)

  return (
    <div className="space-y-6">
      {/* Workflow Selection */}
      <div>
        <h3 className="text-md font-medium text-gray-900 mb-3">Select Workflow for Re-processing</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose a workflow to re-run all existing tasks with. This will create new processing jobs for all tasks in the system.
        </p>
        
        {isLoadingWorkflows ? (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map((workflow) => (
              <div
                key={workflow.id}
                className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                  selectedWorkflowId === workflow.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedWorkflowId(workflow.id)}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    checked={selectedWorkflowId === workflow.id}
                    onChange={() => setSelectedWorkflowId(workflow.id)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">
                        {workflow.name}
                        {workflow.is_default && (
                          <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Default
                          </span>
                        )}
                      </h4>
                      <span className={`text-xs px-2 py-1 rounded ${
                        workflow.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {workflow.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning and Confirmation */}
      {selectedWorkflowId && !showConfirmation && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-yellow-800">Important</h4>
              <div className="text-sm text-yellow-700 mt-1">
                <p>This action will:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Re-run ALL tasks in the system using the selected workflow</li>
                  <li>Create new processing jobs for each task</li>
                  <li>Generate new AI outputs that may override existing results</li>
                  <li>This operation cannot be undone</li>
                </ul>
                <p className="mt-2">
                  Selected workflow: <strong>{selectedWorkflow?.name}</strong>
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => setShowConfirmation(true)}
              className="inline-flex items-center px-4 py-2 border border-yellow-300 rounded-md shadow-sm text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              I understand, proceed
            </button>
          </div>
        </div>
      )}

      {/* Final Confirmation */}
      {showConfirmation && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-red-800">Final Confirmation</h4>
              <p className="text-sm text-red-700 mt-1">
                Are you absolutely sure you want to re-run ALL tasks with the workflow "{selectedWorkflow?.name}"?
              </p>
            </div>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleRerunAll}
              disabled={isRerunning}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRerunning ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Yes, Re-run All Tasks
                </>
              )}
            </button>
            <button
              onClick={() => setShowConfirmation(false)}
              disabled={isRerunning}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Results Section */}
      {rerunResult && (
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-md font-medium text-gray-900 mb-3">Re-run Results</h3>
          
          {rerunResult.success ? (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-green-800">Re-run Successful</h4>
                  <p className="text-sm text-green-700">
                    Successfully queued {rerunResult.successCount} out of {rerunResult.totalTasks} tasks for re-processing.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-red-800">Re-run Failed</h4>
                  <p className="text-sm text-red-700">
                    {rerunResult.successCount} out of {rerunResult.totalTasks} tasks were queued successfully.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error Details */}
          {rerunResult.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Errors:</h4>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-3 max-h-40 overflow-y-auto">
                {rerunResult.errors.map((error, index) => (
                  <p key={index} className="text-sm text-red-600">
                    Task {error.taskId}: {error.message}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset */}
      {rerunResult && (
        <div className="border-t border-gray-200 pt-6">
          <button
            onClick={() => {
              setRerunResult(null)
              setShowConfirmation(false)
              setSelectedWorkflowId(null)
            }}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Start New Re-run
          </button>
        </div>
      )}
    </div>
  )
}