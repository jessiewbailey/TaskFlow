// EventStreamService.ts - Manages all SSE connections for real-time updates

type EventCallback = (data: any) => void;
type Unsubscribe = () => void;

interface ConnectionInfo {
  eventSource: EventSource;
  reconnectAttempts: number;
  reconnectTimer?: number;
}

// Simple EventEmitter implementation for browser
class SimpleEventEmitter {
  private events: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.events.get(event)?.delete(callback);
  }

  emit(event: string, data: any): void {
    this.events.get(event)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener:`, error);
      }
    });
  }

  setMaxListeners(n: number): void {
    // No-op for compatibility
  }
}

class EventStreamService extends SimpleEventEmitter {
  private connections: Map<number, ConnectionInfo> = new Map();
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private baseUrl = '/api'; // Will be proxied by Vite in dev

  constructor() {
    super();
    // Increase max listeners to handle many events
    this.setMaxListeners(100);
  }

  /**
   * Connect to SSE endpoint for a specific request
   */
  connect(requestId: number): EventSource | null {
    // Prevent duplicate connections
    const existing = this.connections.get(requestId);
    if (existing) {
      console.log(`Already connected to request ${requestId}`);
      return existing.eventSource;
    }

    try {
      const url = `${this.baseUrl}/requests/${requestId}/events`;
      const eventSource = new EventSource(url);
      
      // Set up event handlers
      this._setupEventHandlers(eventSource, requestId);
      
      // Store connection info
      this.connections.set(requestId, {
        eventSource,
        reconnectAttempts: 0
      });
      
      console.log(`Connected to SSE for request ${requestId}`);
      return eventSource;
    } catch (error) {
      console.error(`Failed to connect to request ${requestId}:`, error);
      return null;
    }
  }

  /**
   * Disconnect from a specific request's events
   */
  disconnect(requestId: number): void {
    const connection = this.connections.get(requestId);
    if (connection) {
      // Clear any reconnect timer
      if (connection.reconnectTimer) {
        clearTimeout(connection.reconnectTimer);
      }
      
      // Close the connection
      connection.eventSource.close();
      this.connections.delete(requestId);
      
      console.log(`Disconnected from request ${requestId}`);
    }
  }

  /**
   * Connect to multiple requests at once
   */
  connectToRequests(requestIds: number[]): void {
    requestIds.forEach(id => this.connect(id));
  }

  /**
   * Disconnect from all active connections
   */
  disconnectAll(): void {
    this.connections.forEach((_, requestId) => this.disconnect(requestId));
  }

  /**
   * Subscribe to a specific event type
   */
  on(eventType: string, callback: EventCallback): Unsubscribe {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(callback);
    
    // Also use EventEmitter for debugging
    super.on(eventType, callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
      super.off(eventType, callback);
    };
  }

  /**
   * Get all active connections
   */
  getActiveConnections(): number[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Check if connected to a specific request
   */
  isConnected(requestId: number): boolean {
    const connection = this.connections.get(requestId);
    return connection?.eventSource.readyState === EventSource.OPEN;
  }

  /**
   * Set up event handlers for an EventSource
   */
  private _setupEventHandlers(eventSource: EventSource, requestId: number): void {
    // List of event types we expect from the backend
    const eventTypes = [
      'job.started', 'job.progress', 'job.completed', 'job.failed',
      'embedding.started', 'embedding.progress', 'embedding.completed', 'embedding.failed',
      'workflow.started', 'workflow.step.completed', 'workflow.completed', 'workflow.failed',
      'status', 'connected'
    ];

    // Add listeners for each event type
    eventTypes.forEach(eventType => {
      eventSource.addEventListener(eventType, (event) => {
        try {
          const data = JSON.parse(event.data);
          this._notifyListeners(eventType, { requestId, ...data });
        } catch (error) {
          console.error(`Failed to parse event data for ${eventType}:`, error);
        }
      });
    });

    // Handle generic messages
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // If no specific event type, treat as generic update
        this._notifyListeners('message', { requestId, ...data });
      } catch (error) {
        console.error('Failed to parse message data:', error);
      }
    };

    // Handle connection open
    eventSource.onopen = () => {
      console.log(`SSE connection opened for request ${requestId}`);
      const connection = this.connections.get(requestId);
      if (connection) {
        connection.reconnectAttempts = 0;
      }
      this._notifyListeners('connection.opened', { requestId });
    };

    // Handle connection errors with exponential backoff
    eventSource.onerror = (error) => {
      console.error(`SSE error for request ${requestId}:`, error);
      
      if (eventSource.readyState === EventSource.CLOSED) {
        this._handleConnectionError(requestId);
      }
    };
  }

  /**
   * Handle connection errors and implement reconnection logic
   */
  private _handleConnectionError(requestId: number): void {
    const connection = this.connections.get(requestId);
    if (!connection) return;

    connection.reconnectAttempts++;
    
    if (connection.reconnectAttempts <= this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, connection.reconnectAttempts - 1);
      console.log(
        `Reconnecting to request ${requestId} in ${delay}ms ` +
        `(attempt ${connection.reconnectAttempts}/${this.maxReconnectAttempts})`
      );
      
      connection.reconnectTimer = window.setTimeout(() => {
        // Close old connection
        connection.eventSource.close();
        this.connections.delete(requestId);
        
        // Try to reconnect
        this.connect(requestId);
      }, delay);
    } else {
      console.error(`Max reconnection attempts reached for request ${requestId}`);
      this._notifyListeners('connection.failed', { requestId });
      this.disconnect(requestId);
    }
  }

  /**
   * Notify all listeners of an event
   */
  private _notifyListeners(eventType: string, data: any): void {
    // Notify specific event listeners
    this.listeners.get(eventType)?.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    });
    
    // Notify wildcard listeners
    this.listeners.get('*')?.forEach(callback => {
      try {
        callback({ type: eventType, ...data });
      } catch (error) {
        console.error('Error in wildcard event listener:', error);
      }
    });

    // Emit via EventEmitter for debugging
    this.emit(eventType, data);
  }
}

// Create singleton instance
const eventStreamService = new EventStreamService();

// Export for use in React DevTools
if (import.meta.env.DEV) {
  (window as any).__eventStreamService = eventStreamService;
}

export default eventStreamService;