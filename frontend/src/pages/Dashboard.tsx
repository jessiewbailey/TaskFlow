import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { FiltersPanel } from '../components/FiltersPanel'
import { RequestsTable } from '../components/RequestsTable'
import { RequestDrawer } from '../components/RequestDrawer'
import { NewRequestModal } from '../components/NewRequestModal'
import { LogViewer } from '../components/LogViewer'
import { ExerciseDropdown } from '../components/ExerciseDropdown'
import { useRequests } from '../hooks/useRequests'
import { useExercises } from '../hooks/useExercises'
import type { RequestFilters, Task } from '../types'
import { PlusIcon, CogIcon, DocumentTextIcon, Bars3Icon } from '@heroicons/react/24/outline'
import { Logo } from '../components/Logo'

export const Dashboard: React.FC = () => {
  const { exercises, selectedExercise, selectExercise, loading: exercisesLoading } = useExercises()
  
  const [filters, setFilters] = useState<RequestFilters>({
    page: 1,
    page_size: 20,
    sort_by: 'created_at',
    order: 'desc'
  })
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null)
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false)
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false)

  // Update filters when selected exercise changes
  useEffect(() => {
    if (selectedExercise) {
      setFilters(prev => ({
        ...prev,
        exercise_id: selectedExercise.id,
        page: 1 // Reset to first page when exercise changes
      }))
    }
  }, [selectedExercise])

  const { data: requestsData, isLoading, error, refetch } = useRequests(filters)
  
  const handleRequestUpdated = () => {
    refetch()
  }
  
  const handleRequestDeleted = () => {
    setSelectedRequest(null)
    refetch()
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <Logo className="h-8 w-auto" />
                <div className="h-6 w-px bg-gray-300" />
                <ExerciseDropdown
                  exercises={exercises}
                  selectedExercise={selectedExercise}
                  onSelectExercise={selectExercise}
                  loading={exercisesLoading}
                />
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsLogViewerOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <DocumentTextIcon className="h-4 w-4 mr-2" />
                  Logs
                </button>
                <Link
                  to="/batch-jobs"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Bars3Icon className="h-4 w-4 mr-2" />
                  Batch Jobs
                </Link>
                <Link
                  to="/settings"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <CogIcon className="h-4 w-4 mr-2" />
                  Settings
                </Link>
                <button
                  onClick={() => setIsNewRequestModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  New Task
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Filters */}
        <FiltersPanel filters={filters} onFiltersChange={setFilters} />

        {/* Main content area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Requests table */}
          <div className="flex-1 overflow-auto">
            {error ? (
              <div className="p-4 text-red-600">
                Error loading requests: {error.message}
              </div>
            ) : (
              <RequestsTable
                data={requestsData}
                isLoading={isLoading}
                filters={filters}
                onFiltersChange={setFilters}
                onRequestSelect={setSelectedRequest}
                selectedRequestId={selectedRequest?.id}
              />
            )}
          </div>

          {/* Request drawer */}
          <RequestDrawer
            request={selectedRequest}
            isOpen={!!selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onRequestUpdated={handleRequestUpdated}
            onRequestDeleted={handleRequestDeleted}
          />
        </div>
      </div>

      {/* New Request Modal */}
      <NewRequestModal
        isOpen={isNewRequestModalOpen}
        onClose={() => setIsNewRequestModalOpen(false)}
        selectedExercise={selectedExercise}
      />

      {/* Log Viewer */}
      <LogViewer
        isOpen={isLogViewerOpen}
        onClose={() => setIsLogViewerOpen(false)}
      />
    </div>
  )
}