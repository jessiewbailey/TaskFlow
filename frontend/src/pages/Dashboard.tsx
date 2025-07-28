import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FiltersPanel } from '../components/FiltersPanel'
import { RequestsTable } from '../components/RequestsTable'
import { RequestDrawer } from '../components/RequestDrawer'
import { NewRequestModal } from '../components/NewRequestModal'
import { LogViewer } from '../components/LogViewer'
import { ExerciseDropdown } from '../components/ExerciseDropdown'
import { useRequests } from '../hooks/useRequests'
import { useExercises } from '../hooks/useExercises'
import { useUISettings } from '../hooks/useUISettings'
import type { RequestFilters, Task } from '../types'
import { PlusIcon, CogIcon, DocumentTextIcon, Bars3Icon, MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { Logo } from '../components/Logo'
import { RAGSearchSidebar } from '../components/RAGSearchSidebar'

export const Dashboard: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { exercises, selectedExercise, selectExercise, loading: exercisesLoading } = useExercises()
  const { showLogsButton, showSimilarityFeatures } = useUISettings()
  
  const [filters, setFilters] = useState<RequestFilters>({
    page: 1,
    page_size: 20,
    sort_by: 'created_at',
    order: 'desc'
  })
  const [selectedRequest, setSelectedRequest] = useState<Task | null>(null)
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false)
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false)
  const [isRAGSearchOpen, setIsRAGSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [ragSearchEnabled, setRagSearchEnabled] = useState(true)

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

  // Load RAG search enabled setting
  useEffect(() => {
    fetch('/api/settings/rag-search-enabled')
      .then(response => response.json())
      .then(data => {
        setRagSearchEnabled(data.enabled)
      })
      .catch(error => {
        console.error('Error loading RAG search setting:', error)
      })
  }, [])

  const { data: requestsData, isLoading, error, refetch } = useRequests(filters)

  // Handle task parameter from URL
  useEffect(() => {
    const taskId = searchParams.get('task')
    if (taskId) {
      const taskIdNum = parseInt(taskId)
      // First check if task is in current results
      if (requestsData?.requests) {
        const task = requestsData.requests.find(r => r.id === taskIdNum)
        if (task) {
          setSelectedRequest(task)
          return
        }
      }
      // If not found in current results, fetch it directly
      import('../api/client').then(({ taskflowApi }) => {
        taskflowApi.getRequest(taskIdNum)
          .then(task => {
            setSelectedRequest(task)
          })
          .catch(err => {
            console.error('Failed to load task:', err)
          })
      })
    }
  }, [searchParams, requestsData])
  
  // Filter data based on search query
  const filteredData = React.useMemo(() => {
    if (!requestsData || !searchQuery.trim()) {
      return requestsData
    }
    
    const query = searchQuery.toLowerCase()
    const filteredRequests = requestsData.requests.filter(request => {
      // Search in ID
      if (request.id.toString().includes(query)) return true
      
      // Search in requester
      if (request.requester?.toLowerCase().includes(query)) return true
      
      // Search in status
      if (request.status.toLowerCase().includes(query)) return true
      
      // Search in analyst name
      if (request.assigned_analyst?.name.toLowerCase().includes(query)) return true
      
      // Search in task text (context)
      if (request.text.toLowerCase().includes(query)) return true
      
      // Search in exercise name
      if (request.exercise?.name.toLowerCase().includes(query)) return true
      
      return false
    })
    
    return {
      ...requestsData,
      requests: filteredRequests,
      total: filteredRequests.length
    }
  }, [requestsData, searchQuery])
  
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
                <div className="h-6 w-px bg-gray-300" />
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search tasks..."
                    className="block w-80 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {ragSearchEnabled && showSimilarityFeatures && (
                  <button
                    onClick={() => setIsRAGSearchOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    title="RAG Search - Search using natural language"
                  >
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    RAG Search
                  </button>
                )}
                {showLogsButton && (
                  <button
                    onClick={() => setIsLogViewerOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <DocumentTextIcon className="h-4 w-4 mr-2" />
                    Logs
                  </button>
                )}
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
                data={filteredData}
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

      {/* RAG Search Sidebar */}
      <RAGSearchSidebar
        isOpen={isRAGSearchOpen}
        onClose={() => setIsRAGSearchOpen(false)}
        onSelectTask={(taskId) => {
          // Fetch and select the task without closing the sidebar
          import('../api/client').then(({ taskflowApi }) => {
            taskflowApi.getRequest(taskId)
              .then(task => {
                setSelectedRequest(task)
              })
              .catch(err => {
                console.error('Failed to load task:', err)
              })
          })
        }}
      />
    </div>
  )
}