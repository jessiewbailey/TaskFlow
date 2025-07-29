import React, { useState } from 'react'
import { TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

interface PurgeTasksResponse {
  success: boolean
  deleted_count: number
  message: string
}

export const PurgeTasks: React.FC = () => {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const queryClient = useQueryClient()

  const purgeTasksMutation = useMutation({
    mutationFn: async (): Promise<PurgeTasksResponse> => {
      // Get all tasks by paginating through them
      let allTasks: any[] = []
      let page = 1
      let hasMore = true
      
      while (hasMore) {
        try {
          const response = await api.get(`/api/requests?page=${page}&page_size=100`)
          const { requests, total_pages } = response.data
          allTasks = [...allTasks, ...requests]
          hasMore = page < total_pages
          page++
        } catch (error) {
          console.error(`Failed to fetch page ${page}:`, error)
          break
        }
      }
      
      let deletedCount = 0
      
      // Delete each task
      for (const task of allTasks) {
        try {
          await api.delete(`/api/requests/${task.id}`)
          deletedCount++
        } catch (error) {
          console.error(`Failed to delete task ${task.id}:`, error)
        }
      }
      
      return {
        success: true,
        deleted_count: deletedCount,
        message: `Successfully deleted ${deletedCount} tasks`
      }
    },
    onSuccess: (data) => {
      // Invalidate requests query to refresh task list
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      // Also invalidate individual request queries
      queryClient.invalidateQueries({ queryKey: ['request'] })
      setShowConfirmation(false)
      setConfirmText('')
    },
    onError: (error) => {
      console.error('Failed to purge tasks:', error)
    }
  })

  const handlePurgeClick = () => {
    setShowConfirmation(true)
  }

  const handleConfirmPurge = () => {
    if (confirmText === 'DELETE ALL TASKS') {
      purgeTasksMutation.mutate()
    }
  }

  const handleCancel = () => {
    setShowConfirmation(false)
    setConfirmText('')
  }

  return (
    <div className="space-y-6">
      {/* Warning Section */}
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Warning: Destructive Action
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>
                This action will permanently delete ALL tasks from the system. This includes:
              </p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>All tasks with status NEW</li>
                <li>All tasks with status IN_REVIEW</li>
                <li>All tasks with status PENDING</li>
                <li>All tasks with status CLOSED</li>
                <li>All associated AI outputs and analysis</li>
              </ul>
              <p className="mt-2 font-medium">
                This action cannot be undone. All task data will be permanently lost.
              </p>
            </div>
          </div>
        </div>
      </div>

      {!showConfirmation ? (
        /* Initial Purge Button */
        <div className="text-center">
          <button
            onClick={handlePurgeClick}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Purge All Tasks
          </button>
        </div>
      ) : (
        /* Confirmation Section */
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Confirm Task Purge
          </h3>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              To confirm this action, please type <strong>"DELETE ALL TASKS"</strong> in the field below:
            </p>
            
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
              placeholder="Type DELETE ALL TASKS to confirm"
              disabled={purgeTasksMutation.isPending}
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleConfirmPurge}
                disabled={confirmText !== 'DELETE ALL TASKS' || purgeTasksMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purgeTasksMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Purging...
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4 mr-2" />
                    Confirm Purge
                  </>
                )}
              </button>
              
              <button
                onClick={handleCancel}
                disabled={purgeTasksMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {purgeTasksMutation.isError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">
            Failed to purge tasks. Please try again.
          </div>
        </div>
      )}

      {purgeTasksMutation.isSuccess && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-700">
            Successfully deleted {purgeTasksMutation.data?.deleted_count || 0} tasks.
          </div>
        </div>
      )}
    </div>
  )
}