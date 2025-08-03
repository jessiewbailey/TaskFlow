import React from 'react';
import './ProgressBar.css';

/**
 * ProgressBar component for displaying task processing progress
 * 
 * @param {Object} props
 * @param {number} props.percentage - Progress percentage (0-100)
 * @param {string} props.status - Current status (PENDING, RUNNING, COMPLETED, FAILED)
 * @param {string} props.message - Current progress message
 * @param {string} props.currentStep - Current step being processed
 * @param {number} props.stepNumber - Current step number
 * @param {number} props.totalSteps - Total number of steps
 * @param {string} props.variant - Visual variant ('default', 'embedding', 'workflow')
 * @param {boolean} props.showDetails - Whether to show detailed progress info
 * @param {string} props.elapsedTime - Formatted elapsed time
 * @param {string} props.estimatedRemainingTime - Formatted estimated remaining time
 */
export const ProgressBar = ({
  percentage = 0,
  status = 'PENDING',
  message = '',
  currentStep = null,
  stepNumber = 0,
  totalSteps = 0,
  variant = 'default',
  showDetails = true,
  elapsedTime = null,
  estimatedRemainingTime = null
}) => {
  // Determine color based on status
  const getProgressColor = () => {
    switch (status) {
      case 'COMPLETED':
        return 'progress-bar-success';
      case 'FAILED':
        return 'progress-bar-error';
      case 'RUNNING':
        return variant === 'embedding' ? 'progress-bar-embedding' : 
               variant === 'workflow' ? 'progress-bar-workflow' : 
               'progress-bar-primary';
      default:
        return 'progress-bar-default';
    }
  };

  // Determine if progress should be animated
  const isAnimated = status === 'RUNNING' && percentage < 100;

  return (
    <div className={`progress-bar-container ${variant}`}>
      <div className="progress-bar-header">
        <div className="progress-bar-status">
          <span className={`status-indicator status-${status.toLowerCase()}`} />
          <span className="status-text">{status}</span>
          {percentage > 0 && (
            <span className="progress-percentage">{percentage.toFixed(1)}%</span>
          )}
        </div>
        
        {showDetails && (elapsedTime || estimatedRemainingTime) && (
          <div className="progress-bar-timing">
            {elapsedTime && (
              <span className="elapsed-time">Elapsed: {elapsedTime}</span>
            )}
            {estimatedRemainingTime && percentage > 10 && (
              <span className="remaining-time">Est. remaining: {estimatedRemainingTime}</span>
            )}
          </div>
        )}
      </div>

      <div className="progress-bar-track">
        <div 
          className={`progress-bar-fill ${getProgressColor()} ${isAnimated ? 'animated' : ''}`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        >
          {percentage > 5 && (
            <span className="progress-bar-percentage-inline">
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="progress-bar-details">
          {message && (
            <div className="progress-message">{message}</div>
          )}
          
          {totalSteps > 0 && (
            <div className="progress-steps">
              Step {stepNumber} of {totalSteps}
              {currentStep && `: ${currentStep}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
};