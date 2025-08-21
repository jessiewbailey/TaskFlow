import { EventStreamService } from './EventStreamService';

// Mock EventSource
class MockEventSource {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close = jest.fn();

  constructor(url: string) {
    this.url = url;
    this.readyState = 0; // CONNECTING
  }

  addEventListener = jest.fn();
  removeEventListener = jest.fn();
}

// Replace global EventSource with mock and define constants
(global as any).EventSource = MockEventSource;
(global as any).EventSource.CONNECTING = 0;
(global as any).EventSource.OPEN = 1;
(global as any).EventSource.CLOSED = 2;

describe('EventStreamService', () => {
  let service: EventStreamService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventStreamService();
  });

  afterEach(() => {
    service.disconnectAll();
  });

  describe('connect', () => {
    it('creates an EventSource connection for a request', () => {
      const requestId = 123;
      const eventSource = service.connect(requestId) as MockEventSource;

      expect(eventSource).toBeInstanceOf(MockEventSource);
      
      // Initially connecting (readyState = 0)
      expect(service.isConnected(requestId)).toBe(false);
      
      // Simulate connection open
      eventSource.readyState = 1; // OPEN
      expect(service.isConnected(requestId)).toBe(true);
    });

    it('returns existing connection if already connected', () => {
      const requestId = 123;
      const eventSource1 = service.connect(requestId);
      const eventSource2 = service.connect(requestId);

      expect(eventSource1).toBe(eventSource2);
    });
  });

  describe('disconnect', () => {
    it('closes the EventSource connection for a request', () => {
      const requestId = 123;
      const eventSource = service.connect(requestId) as MockEventSource;
      eventSource.readyState = 1; // OPEN
      
      service.disconnect(requestId);

      expect(eventSource.close).toHaveBeenCalled();
      expect(service.isConnected(requestId)).toBe(false);
    });

    it('handles disconnect when not connected', () => {
      expect(() => service.disconnect(999)).not.toThrow();
    });
  });

  describe('disconnectAll', () => {
    it('closes all connections', () => {
      const requestId1 = 123;
      const requestId2 = 456;
      const eventSource1 = service.connect(requestId1) as MockEventSource;
      const eventSource2 = service.connect(requestId2) as MockEventSource;
      
      // Set as connected
      eventSource1.readyState = 1; // OPEN
      eventSource2.readyState = 1; // OPEN

      service.disconnectAll();

      expect(eventSource1.close).toHaveBeenCalled();
      expect(eventSource2.close).toHaveBeenCalled();
      expect(service.isConnected(requestId1)).toBe(false);
      expect(service.isConnected(requestId2)).toBe(false);
    });
  });

  describe('event listening', () => {
    it('allows subscribing to events', () => {
      const handler = jest.fn();
      const unsubscribe = service.on('test-event', handler);

      expect(typeof unsubscribe).toBe('function');

      // Test unsubscribe
      unsubscribe();
    });

    it('calls event handlers when events are emitted', () => {
      const handler = jest.fn();
      service.on('test-event', handler);

      service.emit('test-event', { data: 'test' });

      expect(handler).toHaveBeenCalledWith({ data: 'test' });
    });
  });

  describe('isConnected', () => {
    it('returns false for non-existent connections', () => {
      expect(service.isConnected(999)).toBe(false);
    });

    it('returns true for active connections', () => {
      const requestId = 123;
      const eventSource = service.connect(requestId) as MockEventSource;
      
      // Initially connecting
      expect(service.isConnected(requestId)).toBe(false);
      
      // Simulate connection open
      eventSource.readyState = 1; // OPEN
      expect(service.isConnected(requestId)).toBe(true);
    });
  });

  describe('connectToRequests', () => {
    it('connects to multiple requests', () => {
      const requestIds = [123, 456, 789];
      service.connectToRequests(requestIds);

      // Set all as connected
      requestIds.forEach(id => {
        const eventSource = service['connections'].get(id)?.eventSource as MockEventSource;
        if (eventSource) {
          eventSource.readyState = 1; // OPEN
        }
      });

      requestIds.forEach(id => {
        expect(service.isConnected(id)).toBe(true);
      });
    });
  });

  describe('getActiveConnections', () => {
    it('returns list of connected request IDs', () => {
      const requestIds = [123, 456];
      service.connectToRequests(requestIds);

      const connected = service.getActiveConnections();
      expect(connected).toEqual(expect.arrayContaining(requestIds));
      expect(connected.length).toBe(2);
    });

    it('returns empty array when no connections', () => {
      expect(service.getActiveConnections()).toEqual([]);
    });
  });
});