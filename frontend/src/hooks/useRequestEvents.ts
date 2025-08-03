// useRequestEvents.ts - React hook for subscribing to request events
import { useEffect, useRef } from 'react';
import eventStreamService from '../services/EventStreamService';

type EventHandler = (data: any) => void;
type EventHandlers = Record<string, EventHandler>;

/**
 * Hook to subscribe to events for a specific request
 * 
 * @param requestId - The ID of the request to monitor
 * @param handlers - Object mapping event types to handler functions
 * 
 * @example
 * useRequestEvents(requestId, {
 *   'job.completed': (data) => console.log('Job completed!', data),
 *   'job.progress': (data) => setProgress(data.payload.progress)
 * });
 */
export function useRequestEvents(
  requestId: number | null | undefined,
  handlers: EventHandlers = {}
) {
  const unsubscribers = useRef<Array<() => void>>([]);
  const handlersRef = useRef(handlers);

  // Update handlers ref to avoid stale closures
  handlersRef.current = handlers;

  useEffect(() => {
    if (!requestId) return;

    // Connect to SSE
    const eventSource = eventStreamService.connect(requestId);
    if (!eventSource) {
      console.error(`Failed to connect to events for request ${requestId}`);
      return;
    }

    // Subscribe to each event type
    const currentUnsubscribers: Array<() => void> = [];
    
    Object.entries(handlersRef.current).forEach(([eventType, handler]) => {
      const wrappedHandler = (data: any) => {
        // Only call handler if the event is for this request
        if (data.requestId === requestId) {
          try {
            handler(data);
          } catch (error) {
            console.error(`Error in handler for ${eventType}:`, error);
          }
        }
      };

      const unsubscribe = eventStreamService.on(eventType, wrappedHandler);
      currentUnsubscribers.push(unsubscribe);
    });

    unsubscribers.current = currentUnsubscribers;

    // Cleanup function
    return () => {
      // Unsubscribe from all events
      unsubscribers.current.forEach(unsub => unsub());
      unsubscribers.current = [];
      
      // Disconnect from SSE
      eventStreamService.disconnect(requestId);
    };
  }, [requestId]); // Only reconnect if requestId changes

  // Return connection status
  const isConnected = requestId ? eventStreamService.isConnected(requestId) : false;
  
  return { isConnected };
}

/**
 * Hook to subscribe to events for multiple requests
 * 
 * @param requestIds - Array of request IDs to monitor
 * @param handlers - Object mapping event types to handler functions
 */
export function useMultipleRequestEvents(
  requestIds: number[],
  handlers: EventHandlers = {}
) {
  const unsubscribers = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (!requestIds.length) return;

    // Connect to all requests
    eventStreamService.connectToRequests(requestIds);

    // Subscribe to events
    const currentUnsubscribers: Array<() => void> = [];
    
    Object.entries(handlers).forEach(([eventType, handler]) => {
      const wrappedHandler = (data: any) => {
        // Only call handler if the event is for one of our requests
        if (requestIds.includes(data.requestId)) {
          handler(data);
        }
      };

      const unsubscribe = eventStreamService.on(eventType, wrappedHandler);
      currentUnsubscribers.push(unsubscribe);
    });

    unsubscribers.current = currentUnsubscribers;

    // Cleanup
    return () => {
      unsubscribers.current.forEach(unsub => unsub());
      unsubscribers.current = [];
      
      // Disconnect from all requests
      requestIds.forEach(id => eventStreamService.disconnect(id));
    };
  }, [JSON.stringify(requestIds)]); // Reconnect if request IDs change
}