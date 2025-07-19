import React, { useState } from 'react'
import { ArrowDownTrayIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'

interface ExportStats {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  workflowsUsed: string[]
}

export const ExportData: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false)
  const [exportType, setExportType] = useState<'all' | 'completed'>('completed')

  // Fetch export statistics
  const { data: stats, isLoading: statsLoading } = useQuery<ExportStats>({
    queryKey: ['export-stats'],
    queryFn: async () => {
      const response = await fetch('/api/export/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch export statistics')
      }
      return response.json()
    }
  })

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch(`/api/export/excel?type=${exportType}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      })

      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `taskflow-export-${new Date().toISOString().split('T')[0]}.xlsx`

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Export Statistics */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-gray-900">{stats?.totalTasks || 0}</div>
            <div className="text-sm text-gray-600">Total Tasks</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-green-600">{stats?.completedTasks || 0}</div>
            <div className="text-sm text-gray-600">Completed Tasks</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-2xl font-bold text-orange-600">{stats?.pendingTasks || 0}</div>
            <div className="text-sm text-gray-600">Pending Tasks</div>
          </div>
        </div>
        
        {stats?.workflowsUsed && stats.workflowsUsed.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700">Workflows Used:</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {stats.workflowsUsed.map((workflow, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                >
                  {workflow}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Options</h3>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Export Type</label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="exportType"
                  value="completed"
                  checked={exportType === 'completed'}
                  onChange={(e) => setExportType(e.target.value as 'all' | 'completed')}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Completed tasks only ({stats?.completedTasks || 0} tasks)
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="exportType"
                  value="all"
                  checked={exportType === 'all'}
                  onChange={(e) => setExportType(e.target.value as 'all' | 'completed')}
                  className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-700">
                  All tasks ({stats?.totalTasks || 0} tasks)
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Export Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <DocumentArrowDownIcon className="h-5 w-5 text-blue-400 mt-0.5" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">Export Details</h4>
            <div className="mt-1 text-sm text-blue-700">
              <p>The Excel export will include:</p>
              <ul className="mt-1 list-disc list-inside space-y-1">
                <li>Basic task information (ID, text, submitter, dates, status)</li>
                <li>Workflow assignment and processing status</li>
                <li>Dynamic AI analysis columns based on each task's workflow output</li>
                <li>Processing metadata (model used, tokens, duration)</li>
              </ul>
              <p className="mt-2 font-medium">
                Note: Each task may have different columns based on its assigned workflow's output structure.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="flex justify-center">
        <button
          onClick={handleExport}
          disabled={isExporting || !stats?.totalTasks}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Generating Export...
            </>
          ) : (
            <>
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Export to Excel
            </>
          )}
        </button>
      </div>
    </div>
  )
}