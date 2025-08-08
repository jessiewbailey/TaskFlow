import React, { useState, useEffect } from 'react'
import { format } from 'date-fns'
import clsx from 'clsx'
import type { TaskList, RequestFilters, Task } from '../types'
import { useUILabels } from '../hooks/useConfig'
import { useRequestProgress } from '../hooks/useRequestProgress'
import { ProgressBar } from './ProgressBar'
import { taskflowApi } from '../api/client'

interface TasksTableProps {
  data?: TaskList
  isLoading: boolean
  filters: RequestFilters
  onFiltersChange: (filters: RequestFilters) => void
  onRequestSelect: (request: Task) => void
  selectedRequestId?: number
}

// Component to show processing status with polling for active jobs
const ProcessingStatus: React.FC<{ request: Task, onUpdate?: () => void }> = ({ request, onUpdate }) => {
  const [pollingRequest, setPollingRequest] = useState<Task | null>(null);
  const [jobProgress, setJobProgress] = useState<any>(null);

  useEffect(() => {
    if (!request.has_active_jobs) {
      // Reset polling state when no active jobs
      setPollingRequest(null);
      setJobProgress(null);
      return;
    }

    let pollInterval: NodeJS.Timeout | null = null;
    let isActive = true;

    const startPolling = () => {
      pollInterval = setInterval(async () => {
        if (!isActive) return;

        try {
          // Fetch updated request data
          const updated = await taskflowApi.getRequest(request.id);
          if (!isActive) return;
          
          setPollingRequest(updated);
          
          // If job completed, stop polling and notify parent
          if (!updated.has_active_jobs) {
            if (pollInterval) clearInterval(pollInterval);
            isActive = false;
            if (onUpdate) {
              onUpdate();
            }
            return;
          }
          
          // Fetch job progress if available
          if (updated.latest_job_id) {
            try {
              const progress = await taskflowApi.getJobProgress(updated.latest_job_id);
              if (isActive) {
                setJobProgress(progress);
              }
            } catch (e) {
              // Job progress endpoint might not exist yet
            }
          }
        } catch (error) {
          console.error('Error polling request:', error);
        }
      }, 2000); // Poll every 2 seconds instead of 1
    };

    startPolling();

    return () => {
      isActive = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [request.id, request.has_active_jobs, onUpdate]);

  const displayRequest = pollingRequest || request;

  // If has active jobs and we have progress info, show progress bar
  if (displayRequest.has_active_jobs && jobProgress?.percentage !== undefined) {
    return (
      <div className="w-48">
        <ProgressBar
          percentage={jobProgress.percentage || 0}
          status="RUNNING"
          message={jobProgress.message || 'Processing...'}
          variant="default"
          showDetails={false}
        />
      </div>
    );
  }

  // If has active jobs but no progress yet
  if (displayRequest.has_active_jobs) {
    // Show queue position if available
    if (displayRequest.queue_position !== undefined && displayRequest.queue_position !== null && displayRequest.queue_position >= 0) {
      return (
        <span className="text-amber-600">
          {displayRequest.queue_position === 0 ? 'Starting...' : `${displayRequest.queue_position} jobs ahead`}
        </span>
      );
    }
    return (
      <span className="text-blue-600">
        Processing...
      </span>
    );
  }

  // If failed
  if (displayRequest.latest_failed_job) {
    return (
      <span className="text-red-600" title={displayRequest.latest_failed_job.error_message || 'Processing failed'}>
        Failed
      </span>
    );
  }

  // If completed
  if (displayRequest.latest_ai_output) {
    return (
      <span className="text-green-600">
        v{displayRequest.latest_ai_output.version} completed
      </span>
    );
  }

  // Default pending state
  return <span className="text-gray-400">Pending</span>;
};

const statusColors = {
  NEW: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  PENDING: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-green-100 text-green-800',
}

export const RequestsTableLive: React.FC<TasksTableProps> = ({
  data,
  isLoading,
  filters,
  onFiltersChange,
  onRequestSelect,
  selectedRequestId
}) => {
  const { data: labels } = useUILabels()
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const handlePageChange = (page: number) => {
    onFiltersChange({ ...filters, page })
  }
  
  const handleRequestUpdate = () => {
    // Trigger a refresh by updating filters (this will cause parent to refetch)
    setRefreshTrigger(prev => prev + 1);
    onFiltersChange({ ...filters });
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
                  {format(new Date(request.date_received || request.created_at), 'MMM d, yyyy')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <ProcessingStatus request={request} onUpdate={handleRequestUpdate} />
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
            disabled={data.page === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {data.page} of {data.total_pages}
          </span>
          <button
            onClick={() => handlePageChange(data.page + 1)}
            disabled={!data.has_next}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing{' '}
              <span className="font-medium">{(data.page - 1) * data.page_size + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(data.page * data.page_size, data.total)}
              </span>{' '}
              of <span className="font-medium">{data.total}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              {/* First Page */}
              <button
                onClick={() => handlePageChange(1)}
                disabled={data.page === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              {/* Previous Page */}
              <button
                onClick={() => handlePageChange(Math.max(1, data.page - 1))}
                disabled={data.page === 1}
                className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {/* Page Numbers */}
              {(() => {
                const totalPages = data.total_pages
                const currentPage = data.page
                const pages = []
                const maxVisible = 7
                
                let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2))
                let endPage = Math.min(totalPages, startPage + maxVisible - 1)
                
                if (endPage - startPage + 1 < maxVisible) {
                  startPage = Math.max(1, endPage - maxVisible + 1)
                }
                
                // Always show first page
                if (startPage > 1) {
                  pages.push(
                    <button
                      key={1}
                      onClick={() => handlePageChange(1)}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      1
                    </button>
                  )
                  if (startPage > 2) {
                    pages.push(
                      <span key="dots1" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        ...
                      </span>
                    )
                  }
                }
                
                // Show page numbers
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => handlePageChange(i)}
                      className={clsx(
                        'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                        i === currentPage
                          ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      {i}
                    </button>
                  )
                }
                
                // Always show last page
                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pages.push(
                      <span key="dots2" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                        ...
                      </span>
                    )
                  }
                  pages.push(
                    <button
                      key={totalPages}
                      onClick={() => handlePageChange(totalPages)}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {totalPages}
                    </button>
                  )
                }
                
                return pages
              })()}
              
              {/* Next Page */}
              <button
                onClick={() => handlePageChange(data.page + 1)}
                disabled={!data.has_next}
                className="relative inline-flex items-center px-3 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              
              {/* Last Page */}
              <button
                onClick={() => handlePageChange(data.total_pages)}
                disabled={data.page === data.total_pages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 15.707a1 1 0 010-1.414l5-5a1 1 0 011.414 0l-5 5a1 1 0 01-1.414 0zm6 0a1 1 0 010-1.414l4.293-4.293L10.293 5.707a1 1 0 011.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}