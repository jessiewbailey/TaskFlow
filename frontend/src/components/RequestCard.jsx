import React, { useMemo } from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import { useRequestProgress } from '../hooks/useRequestProgress';
import { ProgressBar } from './ProgressBar';
import './RequestCard.css';

/**
 * Enhanced RequestCard component with real-time progress updates
 * 
 * @param {Object} props
 * @param {Object} props.request - The request/task object
 * @param {boolean} props.isSelected - Whether this card is currently selected
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.showProgress - Whether to show progress bar
 * @param {boolean} props.compact - Compact view mode
 */
export const RequestCard = ({ 
  request, 
  isSelected = false, 
  onClick, 
  showProgress = true,
  compact = false 
}) => {
  // Subscribe to real-time progress updates
  const progress = useRequestProgress(request?.id);
  
  // Determine if we should show the progress bar
  const shouldShowProgress = showProgress && (
    progress.isProcessing || 
    progress.isPending ||
    (progress.isComplete && progress.percentage > 0) ||
    progress.isFailed
  );

  // Get status color
  const statusColor = useMemo(() => {
    const statusMap = {
      NEW: 'status-new',
      IN_REVIEW: 'status-review',
      PENDING: 'status-pending',
      CLOSED: 'status-closed',
    };
    return statusMap[request?.status] || 'status-default';
  }, [request?.status]);

  // Get embedding status indicator
  const embeddingStatusIndicator = useMemo(() => {
    if (!request?.embedding_status) return null;
    
    const statusMap = {
      PENDING: { icon: '⏳', color: 'embedding-pending' },
      PROCESSING: { icon: '🔄', color: 'embedding-processing' },
      COMPLETED: { icon: '✅', color: 'embedding-completed' },
      FAILED: { icon: '❌', color: 'embedding-failed' }
    };
    
    const status = statusMap[request.embedding_status] || statusMap.PENDING;
    return (
      <span className={`embedding-indicator ${status.color}`} title={`Embedding: ${request.embedding_status}`}>
        {status.icon}
      </span>
    );
  }, [request?.embedding_status]);

  if (!request) return null;

  return (
    <div 
      className={clsx(
        'request-card',
        isSelected && 'selected',
        compact && 'compact',
        progress.isProcessing && 'processing'
      )}
      onClick={onClick}
    >
      <div className="request-card-header">
        <div className="request-card-id">#{request.id}</div>
        <div className="request-card-status-group">
          {embeddingStatusIndicator}
          <span className={`request-card-status ${statusColor}`}>
            {request.status}
          </span>
        </div>
      </div>

      <div className="request-card-body">
        <div className="request-card-info">
          <div className="request-card-requester">
            {request.requester || 'Anonymous'}
          </div>
          {request.analyst && (
            <div className="request-card-analyst">
              Assigned to: {request.analyst}
            </div>
          )}
        </div>

        {!compact && request.created_at && (
          <div className="request-card-date">
            {format(new Date(request.created_at), 'MMM d, yyyy h:mm a')}
          </div>
        )}

        {!compact && request.tasks && request.tasks.length > 0 && (
          <div className="request-card-tasks">
            <div className="request-card-tasks-summary">
              {request.tasks.filter(t => t.completed).length} / {request.tasks.length} tasks completed
            </div>
            {request.tasks.slice(0, 2).map((task, index) => (
              <div key={index} className="request-card-task">
                <span className={`task-checkbox ${task.completed ? 'completed' : ''}`}>
                  {task.completed ? '✓' : '○'}
                </span>
                <span className="task-description">{task.description}</span>
              </div>
            ))}
            {request.tasks.length > 2 && (
              <div className="request-card-more-tasks">
                +{request.tasks.length - 2} more tasks
              </div>
            )}
          </div>
        )}
      </div>

      {shouldShowProgress && (
        <div className="request-card-progress">
          <ProgressBar
            percentage={progress.percentage}
            status={progress.status}
            message={progress.message}
            currentStep={progress.currentStep}
            stepNumber={progress.stepNumber}
            totalSteps={progress.totalSteps}
            variant={progress.jobType === 'WORKFLOW' ? 'workflow' : 'embedding'}
            showDetails={!compact}
            elapsedTime={progress.elapsedTime}
            estimatedRemainingTime={progress.estimatedRemainingTime}
          />
        </div>
      )}

      {progress.isProcessing && (
        <div className="request-card-live-indicator">
          <span className="live-dot"></span>
          <span className="live-text">Live</span>
        </div>
      )}
    </div>
  );
};