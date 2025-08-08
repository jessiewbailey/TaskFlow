import { useState, useEffect, useRef } from 'react';
import { taskflowApi } from '../api/client';

interface PollingOptions {
  interval?: number;
  enabled?: boolean;
}

export function useRequestPolling(requestId: number | null | undefined, options: PollingOptions = {}) {
  const { interval = 1000, enabled = true } = options;
  const [request, setRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!requestId || !enabled) {
      setRequest(null);
      return;
    }

    let isActive = true;

    const fetchRequest = async () => {
      try {
        setIsLoading(true);
        const data = await taskflowApi.getRequest(requestId);
        if (isActive) {
          setRequest(data);
        }
        return data;
      } catch (error) {
        console.error('Error fetching request:', error);
        return null;
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    const startPolling = async () => {
      // Initial fetch
      const initialData = await fetchRequest();
      if (!isActive || !initialData?.has_active_jobs) {
        return;
      }

      // Set up polling only if there are active jobs
      intervalRef.current = setInterval(async () => {
        if (!isActive) return;
        
        const updatedData = await fetchRequest();
        
        // Stop polling if no active jobs
        if (!updatedData?.has_active_jobs && intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }, interval);
    };

    startPolling();

    return () => {
      isActive = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [requestId, enabled, interval]);

  return { request, isLoading };
}