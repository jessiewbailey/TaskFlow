// useRequestProgress.ts - React hook for tracking request processing progress
import { useState, useCallback } from 'react';
import { useRequestEvents } from './useRequestEvents';

export interface RequestProgress {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  percentage: number;
  message: string;
  currentStep: string | null;
  stepNumber: number;
  totalSteps: number;
  completedSteps: StepInfo[];
  error: string | null;
  startTime: Date | null;
  endTime: Date | null;
  jobType?: string;
  embeddingStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

interface StepInfo {
  name: string;
  completedAt: Date;
  result?: any;
}

const initialProgress: RequestProgress = {
  status: 'PENDING',
  percentage: 0,
  message: '',
  currentStep: null,
  stepNumber: 0,
  totalSteps: 0,
  completedSteps: [],
  error: null,
  startTime: null,
  endTime: null
};

/**
 * Hook to track the progress of a request's processing
 * 
 * @param requestId - The ID of the request to track
 * @returns Progress information and helper functions
 */
export function useRequestProgress(requestId: number | null | undefined) {
  const [progress, setProgress] = useState<RequestProgress>(initialProgress);

  // Handler functions for different event types
  const handleJobStarted = useCallback((data: any) => {
    setProgress(prev => ({
      ...prev,
      status: 'RUNNING',
      startTime: new Date(),
      jobType: data.payload?.job_type,
      message: `Starting ${data.payload?.job_type || 'job'}...`
    }));
  }, []);

  const handleJobProgress = useCallback((data: any) => {
    const payload = data.payload || {};
    const message = payload.message || '';
    
    // Try to parse step information from message
    const stepMatch = message.match(/Step (\d+)\/(\d+): (.*?)( ✓)?$/);
    
    setProgress(prev => ({
      ...prev,
      percentage: (payload.progress || 0) * 100,
      message: message,
      ...(stepMatch ? {
        stepNumber: parseInt(stepMatch[1]),
        totalSteps: parseInt(stepMatch[2]),
        currentStep: stepMatch[3]
      } : {})
    }));
  }, []);

  const handleWorkflowStarted = useCallback((data: any) => {
    setProgress(prev => ({
      ...prev,
      status: 'RUNNING',
      jobType: 'WORKFLOW',
      message: 'Workflow started'
    }));
  }, []);

  const handleStepCompleted = useCallback((data: any) => {
    const payload = data.payload || {};
    
    setProgress(prev => ({
      ...prev,
      completedSteps: [...prev.completedSteps, {
        name: payload.step_name,
        completedAt: new Date(),
        result: payload.result
      }],
      currentStep: null
    }));
  }, []);

  const handleJobCompleted = useCallback((data: any) => {
    setProgress(prev => ({
      ...prev,
      status: 'COMPLETED',
      percentage: 100,
      endTime: new Date(),
      message: 'Processing completed',
      currentStep: null
    }));
  }, []);

  const handleJobFailed = useCallback((data: any) => {
    const error = data.payload?.error || 'Unknown error';
    
    setProgress(prev => ({
      ...prev,
      status: 'FAILED',
      error: error,
      endTime: new Date(),
      message: `Failed: ${error}`,
      currentStep: null
    }));
  }, []);

  const handleEmbeddingProgress = useCallback((data: any) => {
    const payload = data.payload || {};
    
    setProgress(prev => ({
      ...prev,
      embeddingStatus: payload.status,
      ...(payload.progress !== undefined && {
        percentage: payload.progress * 100,
        message: payload.message || prev.message
      })
    }));
  }, []);

  const handleStatus = useCallback((data: any) => {
    const payload = data.payload || {};
    
    setProgress(prev => ({
      ...prev,
      ...(payload.embedding_status && {
        embeddingStatus: payload.embedding_status
      })
    }));
  }, []);

  // Subscribe to events
  const { isConnected } = useRequestEvents(requestId, {
    'job.started': handleJobStarted,
    'job.progress': handleJobProgress,
    'job.completed': handleJobCompleted,
    'job.failed': handleJobFailed,
    'workflow.started': handleWorkflowStarted,
    'workflow.step.completed': handleStepCompleted,
    'workflow.completed': handleJobCompleted,
    'workflow.failed': handleJobFailed,
    'embedding.started': handleJobStarted,
    'embedding.progress': handleEmbeddingProgress,
    'embedding.completed': handleJobCompleted,
    'embedding.failed': handleJobFailed,
    'status': handleStatus
  });

  // Calculate derived values
  const elapsedTime = progress.startTime
    ? (progress.endTime || new Date()).getTime() - progress.startTime.getTime()
    : 0;

  const elapsedSeconds = Math.floor(elapsedTime / 1000);
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const remainingSeconds = elapsedSeconds % 60;
  const formattedTime = `${elapsedMinutes}:${remainingSeconds.toString().padStart(2, '0')}`;

  // Estimate remaining time based on progress
  const estimatedTotalTime = progress.percentage > 0
    ? (elapsedTime / progress.percentage) * 100
    : 0;
  const estimatedRemainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
  const estimatedRemainingSeconds = Math.floor(estimatedRemainingTime / 1000);
  const estimatedRemainingMinutes = Math.floor(estimatedRemainingSeconds / 60);
  const remainingSecondsEstimate = estimatedRemainingSeconds % 60;
  const formattedRemainingTime = progress.percentage > 10 // Only show after 10% progress
    ? `${estimatedRemainingMinutes}:${remainingSecondsEstimate.toString().padStart(2, '0')}`
    : null;

  return {
    ...progress,
    isConnected,
    elapsedTime: formattedTime,
    estimatedRemainingTime: formattedRemainingTime,
    isProcessing: progress.status === 'RUNNING',
    isComplete: progress.status === 'COMPLETED',
    isFailed: progress.status === 'FAILED',
    isPending: progress.status === 'PENDING'
  };
}