import React from 'react'
import { format } from 'date-fns'
import clsx from 'clsx'
import type { TaskList, RequestFilters, Task } from '../types'
import { useUILabels } from '../hooks/useConfig'

interface TasksTableProps {
  data?: TaskList
  isLoading: boolean
  filters: RequestFilters
  onFiltersChange: (filters: RequestFilters) => void
  onRequestSelect: (request: Task) => void
  selectedRequestId?: number
}

// Legacy interface name for compatibility
interface RequestsTableProps extends TasksTableProps {}

const statusColors = {
  NEW: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  PENDING: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-green-100 text-green-800',
}

export const RequestsTable: React.FC<RequestsTableProps> = ({
  data,
  isLoading,
  filters,
  onFiltersChange,
  onRequestSelect,
  selectedRequestId
}) => {
  const { data: labels } = useUILabels()
  const handlePageChange = (page: number) => {
    onFiltersChange({ ...filters, page })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!data || data.requests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No requests found
      </div>
    )
  }

  return (
    <div className="bg-white">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {labels?.dashboard?.table?.requester || 'Submitter'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {labels?.dashboard?.table?.analyst || 'Assignee'}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date Submitted
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Processing Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.requests.map((request) => (
              <tr
                key={request.id}
                className={clsx(
                  'hover:bg-gray-50 cursor-pointer',
                  selectedRequestId === request.id && 'bg-indigo-50'
                )}
                onClick={() => onRequestSelect(request)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{request.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {request.requester || 'Anonymous'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={clsx(
                    'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                    statusColors[request.status]
                  )}>
                    {request.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {request.assigned_analyst?.name || 'Unassigned'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {format(new Date(request.date_received), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {request.has_active_jobs ? (
                    <span className="text-blue-600">
                      Processing...
                    </span>
                  ) : request.latest_ai_output ? (
                    <span className="text-green-600">
                      v{request.latest_ai_output.version} completed
                    </span>
                  ) : (
                    <span className="text-gray-400">Pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(Math.max(1, data.page - 1))}
            disabled={data.page <= 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(data.page + 1)}
            disabled={data.page >= data.total_pages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">
                {(data.page - 1) * data.page_size + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(data.page * data.page_size, data.total)}
              </span>{' '}
              of{' '}
              <span className="font-medium">{data.total}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                onClick={() => handlePageChange(Math.max(1, data.page - 1))}
                disabled={data.page <= 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, data.total_pages) }, (_, i) => {
                const page = i + 1
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={clsx(
                      'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                      page === data.page
                        ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    )}
                  >
                    {page}
                  </button>
                )
              })}
              <button
                onClick={() => handlePageChange(data.page + 1)}
                disabled={data.page >= data.total_pages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}