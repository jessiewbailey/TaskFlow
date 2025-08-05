import React, { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'

interface RAGSearchSidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectTask?: (taskId: number) => void
}

interface SearchResult {
  task_id: number
  title: string
  description: string
  similarity_score: number
  status?: string
  priority?: string | null
  created_at?: string | null
  exercise_id?: number | null
  // Allow additional dynamic fields
  [key: string]: any
}

export const RAGSearchSidebar: React.FC<RAGSearchSidebarProps> = ({ isOpen, onClose, onSelectTask }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Advanced search parameters
  const [maxResults, setMaxResults] = useState(5)
  const [temperature, setTemperature] = useState(0.7)
  const [filterExercise, setFilterExercise] = useState<number | null>(null)
  const [filterPriority, setFilterPriority] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')

  const performSearch = async () => {
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const filters: any = {}
      if (filterExercise) filters.exercise_id = filterExercise
      if (filterPriority) filters.priority = filterPriority
      if (filterStatus) filters.status = filterStatus

      const response = await fetch('/api/rag-search/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          limit: maxResults,
          temperature,
          filters: Object.keys(filters).length > 0 ? filters : null,
          include_scores: true
        })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.results)
    } catch (error) {
      console.error('Error performing AI search:', error)
      // TODO: Show error message to user
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      performSearch()
    }
  }

  const handleTaskClick = (taskId: number) => {
    if (onSelectTask) {
      onSelectTask(taskId)
    } else {
      // Fallback to navigation if no handler provided
      window.location.href = `/?task=${taskId}`
    }
  }

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 left-0 flex max-w-full pr-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="-translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="-translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto relative w-screen max-w-md" onClick={(e) => e.stopPropagation()}>
                  <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                    <div className="bg-indigo-700 px-4 py-6 sm:px-6">
                      <div className="flex items-center justify-between">
                        <Dialog.Title className="text-base font-semibold leading-6 text-white">
                          AI Search
                        </Dialog.Title>
                        <div className="ml-3 flex h-7 items-center">
                          <button
                            type="button"
                            className="relative rounded-md bg-indigo-700 text-indigo-200 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
                            onClick={onClose}
                          >
                            <span className="absolute -inset-2.5" />
                            <span className="sr-only">Close panel</span>
                            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1">
                        <p className="text-sm text-indigo-300">
                          Search for similar tasks using natural language
                        </p>
                      </div>
                    </div>

                    <div className="relative flex-1 px-4 py-6 sm:px-6">
                      {/* Search Input */}
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="search-query" className="block text-sm font-medium text-gray-700">
                            Search Query
                          </label>
                          <div className="mt-1 relative">
                            <textarea
                              id="search-query"
                              rows={3}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              placeholder="Describe what you're looking for..."
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              onKeyPress={handleKeyPress}
                            />
                          </div>
                        </div>

                        {/* Advanced Options Toggle */}
                        <div>
                          <button
                            type="button"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                          >
                            <AdjustmentsHorizontalIcon className="h-5 w-5 mr-1" />
                            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                          </button>
                        </div>

                        {/* Advanced Options */}
                        {showAdvanced && (
                          <div className="space-y-4 border-t border-gray-200 pt-4">
                            <div>
                              <label htmlFor="max-results" className="block text-sm font-medium text-gray-700">
                                Maximum Results
                              </label>
                              <input
                                type="number"
                                id="max-results"
                                min="1"
                                max="20"
                                value={maxResults}
                                onChange={(e) => setMaxResults(parseInt(e.target.value) || 5)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              />
                            </div>

                            <div>
                              <label htmlFor="temperature" className="block text-sm font-medium text-gray-700">
                                Temperature (Diversity)
                              </label>
                              <input
                                type="number"
                                id="temperature"
                                min="0"
                                max="1"
                                step="0.1"
                                value={temperature}
                                onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              />
                              <p className="mt-1 text-xs text-gray-500">
                                Higher values (0.8-1.0) give more diverse results
                              </p>
                            </div>

                            <div>
                              <label htmlFor="filter-priority" className="block text-sm font-medium text-gray-700">
                                Filter by Priority
                              </label>
                              <select
                                id="filter-priority"
                                value={filterPriority}
                                onChange={(e) => setFilterPriority(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value="">All priorities</option>
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                              </select>
                            </div>

                            <div>
                              <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700">
                                Filter by Status
                              </label>
                              <select
                                id="filter-status"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value="">All statuses</option>
                                <option value="NEW">New</option>
                                <option value="IN_REVIEW">In Review</option>
                                <option value="PENDING">Pending</option>
                                <option value="CLOSED">Closed</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {/* Search Button */}
                        <div>
                          <button
                            type="button"
                            onClick={performSearch}
                            disabled={isSearching || !query.trim()}
                            className={`${
                              isSearching || !query.trim()
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            } w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                          >
                            <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                            {isSearching ? 'Searching...' : 'Search'}
                          </button>
                        </div>

                        {/* Results */}
                        {results.length > 0 && (
                          <div className="mt-6">
                            <h3 className="text-sm font-medium text-gray-900 mb-3">
                              Search Results ({results.length})
                            </h3>
                            <div className="space-y-3">
                              {results.map((result) => (
                                <div
                                  key={result.task_id}
                                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleTaskClick(result.task_id)
                                  }}
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-medium text-gray-900">
                                          Task #{result.task_id}
                                        </h4>
                                        <span className="text-xs text-gray-500">
                                          {(result.similarity_score * 100).toFixed(1)}% match
                                        </span>
                                      </div>
                                      {/* Display summary if available from similarity config */}
                                      {result.summary && (
                                        <p className="mt-1 text-sm text-gray-700 font-medium">
                                          {result.summary}
                                        </p>
                                      )}
                                      
                                      {/* Fallback to description if no summary */}
                                      {!result.summary && result.description && (
                                        <p className="mt-1 text-sm text-gray-600 line-clamp-3">
                                          {result.description}
                                        </p>
                                      )}
                                      {/* Display any custom fields */}
                                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                        {result.status && <span className="bg-gray-100 px-2 py-1 rounded">Status: {result.status}</span>}
                                        {result.priority && <span className="bg-gray-100 px-2 py-1 rounded">Priority: {result.priority}</span>}
                                        {result.created_at && (
                                          <span className="bg-gray-100 px-2 py-1 rounded">Created: {new Date(result.created_at).toLocaleDateString()}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* No Results Message */}
                        {results.length === 0 && query && !isSearching && (
                          <div className="text-center py-8 text-gray-500">
                            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-2 text-sm">No matching tasks found</p>
                            <p className="text-xs">Try adjusting your search query or filters</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}