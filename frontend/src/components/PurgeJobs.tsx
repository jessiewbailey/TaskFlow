import React, { useState } from 'react'
import { TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/client'

interface PurgeJobsResponse {
  success: boolean
  deleted_count: number
  message: string
}

export const PurgeJobs: React.FC = () => {
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const queryClient = useQueryClient()

  const purgeJobsMutation = useMutation({
    mutationFn: async (): Promise<PurgeJobsResponse> => {
      const response = await api.delete('/api/jobs/purge')
      return response.data
    },
    onSuccess: (data) => {
      // Invalidate any job-related queries
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['processing-jobs'] })
      setShowConfirmation(false)
      setConfirmText('')
    },
    onError: (error) => {
      console.error('Failed to purge jobs:', error)
    }
  })

  const handlePurgeClick = () => {
    setShowConfirmation(true)
  }

  const handleConfirmPurge = () => {
    if (confirmText === 'DELETE ALL JOBS') {
      purgeJobsMutation.mutate()
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
                This action will permanently delete ALL processing jobs from the system. This includes:
              </p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                <li>All pending jobs</li>
                <li>All running jobs</li>
                <li>All completed jobs</li>
                <li>All failed jobs</li>
              </ul>
              <p className="mt-2 font-medium">
                This action cannot be undone. The actual task data and AI outputs will not be affected.
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
            Purge All Jobs
          </button>
        </div>
      ) : (
        /* Confirmation Section */
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Confirm Job Purge
          </h3>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              To confirm this action, please type <strong>"DELETE ALL JOBS"</strong> in the field below:
            </p>
            
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
              placeholder="Type DELETE ALL JOBS to confirm"
              disabled={purgeJobsMutation.isPending}
            />
            
            <div className="flex space-x-3">
              <button
                onClick={handleConfirmPurge}
                disabled={confirmText !== 'DELETE ALL JOBS' || purgeJobsMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {purgeJobsMutation.isPending ? (
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
                disabled={purgeJobsMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {purgeJobsMutation.isError && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">
            Failed to purge jobs. Please try again.
          </div>
        </div>
      )}

      {purgeJobsMutation.isSuccess && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-700">
            Successfully deleted {purgeJobsMutation.data?.deleted_count || 0} processing jobs.
          </div>
        </div>
      )}
    </div>
  )
}