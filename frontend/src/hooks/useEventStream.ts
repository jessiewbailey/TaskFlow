// Event stream hook for SSE connections
import { useEffect, useState, useRef, useCallback } from 'react';

export interface EventStreamOptions {
  onMessage?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

export function useEventStream(url: string, options?: EventStreamOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      options?.onOpen?.();
    };

    eventSource.onmessage = (event) => {
      options?.onMessage?.(event);
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      setError(new Error('EventSource connection error'));
      options?.onError?.(error);
      
      if (options?.reconnect) {
        setTimeout(() => {
          connect();
        }, options.reconnectInterval || 5000);
      }
    };
  }, [url, options]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return {
    isConnected,
    error,
    reconnect: connect,
  };
}