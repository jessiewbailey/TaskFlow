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
      return;
    }

    const fetchRequest = async () => {
      try {
        setIsLoading(true);
        const data = await taskflowApi.getRequest(requestId);
        setRequest(data);
      } catch (error) {
        console.error('Error fetching request:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchRequest();

    // Set up polling if request has active jobs
    intervalRef.current = setInterval(() => {
      if (request?.has_active_jobs) {
        fetchRequest();
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [requestId, enabled, interval, request?.has_active_jobs]);

  return { request, isLoading };
}