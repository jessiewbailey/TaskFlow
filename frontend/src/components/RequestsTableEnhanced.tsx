import React, { useState } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import type { TaskList, RequestFilters, Task } from '../types';
import { useUILabels } from '../hooks/useConfig';
import { RequestCard } from './RequestCard';
import { Bars3Icon, Squares2X2Icon } from '@heroicons/react/24/outline';

interface RequestsTableEnhancedProps {
  data?: TaskList;
  isLoading: boolean;
  filters: RequestFilters;
  onFiltersChange: (filters: RequestFilters) => void;
  onRequestSelect: (request: Task) => void;
  selectedRequestId?: number;
}

const statusColors = {
  NEW: 'bg-blue-100 text-blue-800',
  IN_REVIEW: 'bg-yellow-100 text-yellow-800',
  PENDING: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-green-100 text-green-800',
};

export const RequestsTableEnhanced: React.FC<RequestsTableEnhancedProps> = ({
  data,
  isLoading,
  filters,
  onFiltersChange,
  onRequestSelect,
  selectedRequestId
}) => {
  const { data: labels } = useUILabels();
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  
  const handlePageChange = (page: number) => {
    onFiltersChange({ ...filters, page });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!data || data.requests.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No requests found
      </div>
    );
  }

  return (
    <div className="bg-white">
      {/* View Mode Toggle */}
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Requests</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('table')}
            className={clsx(
              'p-2 rounded-md',
              viewMode === 'table'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            )}
            title="Table view"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={clsx(
              'p-2 rounded-md',
              viewMode === 'cards'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            )}
            title="Card view"
          >
            <Squares2X2Icon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'table' ? (
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Embedding
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
                    {request.has_active_jobs ? (
                      <span className="text-blue-600">
                        Processing...
                      </span>
                    ) : request.latest_failed_job ? (
                      <span className="text-red-600" title={request.latest_failed_job.error_message || 'Processing failed'}>
                        Failed
                      </span>
                    ) : request.latest_ai_output ? (
                      <span className="text-green-600">
                        v{request.latest_ai_output.version} completed
                      </span>
                    ) : (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {request.embedding_status === 'COMPLETED' && (
                      <span className="text-green-600">✅</span>
                    )}
                    {request.embedding_status === 'PROCESSING' && (
                      <span className="text-blue-600">🔄</span>
                    )}
                    {request.embedding_status === 'PENDING' && (
                      <span className="text-gray-400">⏳</span>
                    )}
                    {request.embedding_status === 'FAILED' && (
                      <span className="text-red-600">❌</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isSelected={selectedRequestId === request.id}
              onClick={() => onRequestSelect(request)}
              showProgress={true}
              compact={false}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(Math.max(1, data.page - 1))}
            disabled={data.page === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(data.page + 1)}
            disabled={!data.has_next}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
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
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
              <button
                onClick={() => handlePageChange(Math.max(1, data.page - 1))}
                disabled={data.page === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(data.page + 1)}
                disabled={!data.has_next}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Next
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};