import React, { useState, useEffect } from 'react'
import { Settings } from './Settings'
import { InformationCircleIcon } from '@heroicons/react/24/outline'

export const SimilaritySearchSettings: React.FC = () => {
  const [similarityLimit, setSimilarityLimit] = useState<number>(5)
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.0)
  const [restrictToSameExercise, setRestrictToSameExercise] = useState<boolean>(false)
  const [ragSearchEnabled, setRagSearchEnabled] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    // Load saved settings from localStorage
    const savedLimit = localStorage.getItem('similaritySearchLimit')
    if (savedLimit) {
      setSimilarityLimit(parseInt(savedLimit, 10))
    }
    
    const savedThreshold = localStorage.getItem('similarityThreshold')
    if (savedThreshold) {
      setSimilarityThreshold(parseFloat(savedThreshold))
    }
    
    const savedRestrictToExercise = localStorage.getItem('restrictToSameExercise')
    if (savedRestrictToExercise) {
      setRestrictToSameExercise(savedRestrictToExercise === 'true')
    }
    
    // Load RAG search enabled setting from backend
    fetch('/api/settings/rag-search-enabled')
      .then(response => response.json())
      .then(data => {
        setRagSearchEnabled(data.enabled)
      })
      .catch(error => {
        console.error('Error loading RAG search setting:', error)
      })
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setSaveMessage(null)

    // Save to localStorage
    localStorage.setItem('similaritySearchLimit', similarityLimit.toString())
    localStorage.setItem('similarityThreshold', similarityThreshold.toString())
    localStorage.setItem('restrictToSameExercise', restrictToSameExercise.toString())

    try {
      // Save RAG search enabled setting to backend
      const response = await fetch('/api/settings/system/rag_search_enabled', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: ragSearchEnabled })
      })
      
      if (!response.ok) {
        throw new Error('Failed to save RAG search setting')
      }
      
      setIsSaving(false)
      setSaveMessage('Settings saved successfully!')
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null)
      }, 3000)
    } catch (error) {
      console.error('Error saving settings:', error)
      setIsSaving(false)
      setSaveMessage('Error saving settings. Please try again.')
    }
  }

  return (
    <Settings>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Similarity Search Settings</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure how similarity search works when finding related tasks.
          </p>
        </div>

        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="space-y-6">
              {/* Information Alert */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <InformationCircleIcon className="h-5 w-5 text-blue-400" aria-hidden="true" />
                  </div>
                  <div className="ml-3 flex-1 md:flex md:justify-between">
                    <p className="text-sm text-blue-700">
                      Similarity search uses AI embeddings to find tasks with similar content. 
                      When you open a task, you can search for the most similar existing tasks 
                      to help with context and decision making.
                    </p>
                  </div>
                </div>
              </div>

              {/* Number of Results Setting */}
              <div>
                <label htmlFor="similarity-limit" className="block text-sm font-medium text-gray-700">
                  Number of Similar Results (N)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm max-w-xs">
                  <input
                    type="number"
                    name="similarity-limit"
                    id="similarity-limit"
                    min="1"
                    max="50"
                    value={similarityLimit}
                    onChange={(e) => setSimilarityLimit(parseInt(e.target.value, 10) || 5)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">results</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  How many similar tasks to return when performing a similarity search. 
                  Recommended range: 3-10 results.
                </p>
              </div>

              {/* Similarity Threshold Setting */}
              <div>
                <label htmlFor="similarity-threshold" className="block text-sm font-medium text-gray-700">
                  Similarity Threshold
                </label>
                <div className="mt-1 relative rounded-md shadow-sm max-w-xs">
                  <input
                    type="number"
                    name="similarity-threshold"
                    id="similarity-threshold"
                    min="0"
                    max="1"
                    step="0.1"
                    value={similarityThreshold}
                    onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value) || 0)}
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pr-20 sm:text-sm border-gray-300 rounded-md"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">({(similarityThreshold * 100).toFixed(0)}%)</span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Minimum similarity score required to show a task. 0 = show all results, 1 = exact match only.
                  Recommended: 0.3-0.7 for balanced results.
                </p>
              </div>

              {/* Exercise Restriction Setting */}
              <div>
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="restrict-to-exercise"
                      name="restrict-to-exercise"
                      type="checkbox"
                      checked={restrictToSameExercise}
                      onChange={(e) => setRestrictToSameExercise(e.target.checked)}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="restrict-to-exercise" className="font-medium text-gray-700">
                      Restrict to same exercise
                    </label>
                    <p className="text-gray-500">
                      When enabled, similarity search will only show tasks from the same exercise as the current task.
                      Useful for keeping search results within the same project or context.
                    </p>
                  </div>
                </div>
              </div>

              {/* RAG Search Visibility Setting */}
              <div>
                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="rag-search-enabled"
                      name="rag-search-enabled"
                      type="checkbox"
                      checked={ragSearchEnabled}
                      onChange={(e) => setRagSearchEnabled(e.target.checked)}
                      className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="rag-search-enabled" className="font-medium text-gray-700">
                      Enable RAG Search Feature
                    </label>
                    <p className="text-gray-500">
                      When enabled, the RAG (Retrieval-Augmented Generation) search feature will be visible on the dashboard.
                      This allows users to perform custom similarity searches using natural language queries.
                    </p>
                  </div>
                </div>
              </div>

              {/* Advanced Settings (Future) */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-900">Advanced Settings</h3>
                <div className="mt-4 space-y-4">
                  <div className="text-sm text-gray-500">
                    <p>Future enhancements may include:</p>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      <li>Similarity threshold configuration</li>
                      <li>Filter by exercise or status</li>
                      <li>Custom embedding model selection</li>
                      <li>Batch similarity analysis</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            {saveMessage && (
              <div className="mb-3 sm:mb-0 sm:ml-3">
                <p className="text-sm text-green-600">{saveMessage}</p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`${
                isSaving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              } w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm`}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>

        {/* Usage Statistics (Future) */}
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Usage Statistics</h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>Coming soon: View statistics about similarity search usage and performance.</p>
            </div>
          </div>
        </div>
      </div>
    </Settings>
  )
}