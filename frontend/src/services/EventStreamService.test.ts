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

// Replace global EventSource with mock
(global as any).EventSource = MockEventSource;

describe('EventStreamService', () => {
  let service: EventStreamService;
  let mockEventSource: MockEventSource;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EventStreamService();
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('connect', () => {
    it('creates an EventSource connection', () => {
      const url = '/api/events';
      service.connect(url);

      expect(service.isConnected()).toBe(false); // Still connecting
      expect(service['eventSource']).toBeInstanceOf(MockEventSource);
    });

    it('calls onConnect when connection opens', () => {
      const onConnect = jest.fn();
      service.connect('/api/events', { onConnect });

      mockEventSource = service['eventSource'] as MockEventSource;
      mockEventSource.readyState = 1; // OPEN

      // Simulate open event
      const openEvent = new Event('open');
      mockEventSource.onopen?.(openEvent);

      expect(onConnect).toHaveBeenCalled();
      expect(service.isConnected()).toBe(true);
    });

    it('handles connection errors', () => {
      const onError = jest.fn();
      service.connect('/api/events', { onError });

      mockEventSource = service['eventSource'] as MockEventSource;

      // Simulate error event
      const errorEvent = new Event('error');
      mockEventSource.onerror?.(errorEvent);

      expect(onError).toHaveBeenCalledWith(errorEvent);
    });

    it('closes existing connection before creating new one', () => {
      service.connect('/api/events1');
      const firstEventSource = service['eventSource'] as MockEventSource;

      service.connect('/api/events2');
      
      expect(firstEventSource.close).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('closes the EventSource connection', () => {
      service.connect('/api/events');
      mockEventSource = service['eventSource'] as MockEventSource;

      service.disconnect();

      expect(mockEventSource.close).toHaveBeenCalled();
      expect(service['eventSource']).toBeNull();
    });

    it('handles disconnect when not connected', () => {
      expect(() => service.disconnect()).not.toThrow();
    });
  });

  describe('subscribe', () => {
    beforeEach(() => {
      service.connect('/api/events');
      mockEventSource = service['eventSource'] as MockEventSource;
    });

    it('subscribes to event types', () => {
      const handler = jest.fn();
      const unsubscribe = service.subscribe('test-event', handler);

      expect(mockEventSource.addEventListener).toHaveBeenCalledWith('test-event', expect.any(Function));
      expect(typeof unsubscribe).toBe('function');
    });

    it('calls handler when event is received', () => {
      const handler = jest.fn();
      service.subscribe('test-event', handler);

      // Get the actual handler that was registered
      const registeredHandler = mockEventSource.addEventListener.mock.calls[0][1];

      // Simulate event
      const messageEvent = new MessageEvent('test-event', {
        data: JSON.stringify({ message: 'test' }),
      });

      registeredHandler(messageEvent);

      expect(handler).toHaveBeenCalledWith({ message: 'test' });
    });

    it('handles non-JSON data', () => {
      const handler = jest.fn();
      service.subscribe('test-event', handler);

      const registeredHandler = mockEventSource.addEventListener.mock.calls[0][1];

      // Simulate event with plain text
      const messageEvent = new MessageEvent('test-event', {
        data: 'plain text',
      });

      registeredHandler(messageEvent);

      expect(handler).toHaveBeenCalledWith('plain text');
    });

    it('unsubscribes correctly', () => {
      const handler = jest.fn();
      const unsubscribe = service.subscribe('test-event', handler);

      unsubscribe();

      expect(mockEventSource.removeEventListener).toHaveBeenCalledWith('test-event', expect.any(Function));
    });

    it('returns noop unsubscribe if not connected', () => {
      service.disconnect();
      
      const handler = jest.fn();
      const unsubscribe = service.subscribe('test-event', handler);

      expect(() => unsubscribe()).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onMessage', () => {
    it('handles message events', () => {
      const onMessage = jest.fn();
      service.connect('/api/events', { onMessage });

      mockEventSource = service['eventSource'] as MockEventSource;

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'update', payload: 'test' }),
      });

      mockEventSource.onmessage?.(messageEvent);

      expect(onMessage).toHaveBeenCalledWith(messageEvent);
    });

    it('parses event data when possible', () => {
      let receivedData: any;
      const onMessage = (event: MessageEvent) => {
        try {
          receivedData = JSON.parse(event.data);
        } catch {
          receivedData = event.data;
        }
      };

      service.connect('/api/events', { onMessage });
      mockEventSource = service['eventSource'] as MockEventSource;

      const messageEvent = new MessageEvent('message', {
        data: JSON.stringify({ type: 'update', id: 123 }),
      });

      mockEventSource.onmessage?.(messageEvent);

      expect(receivedData).toEqual({ type: 'update', id: 123 });
    });
  });

  describe('isConnected', () => {
    it('returns false when not connected', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('returns false when connecting', () => {
      service.connect('/api/events');
      expect(service.isConnected()).toBe(false);
    });

    it('returns true when connected', () => {
      service.connect('/api/events');
      mockEventSource = service['eventSource'] as MockEventSource;
      mockEventSource.readyState = 1; // OPEN

      expect(service.isConnected()).toBe(true);
    });

    it('returns false when connection closed', () => {
      service.connect('/api/events');
      mockEventSource = service['eventSource'] as MockEventSource;
      mockEventSource.readyState = 2; // CLOSED

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('reconnection', () => {
    it('attempts to reconnect on error if enabled', (done) => {
      const reconnectDelay = 100;
      service.connect('/api/events', { 
        reconnect: true, 
        reconnectDelay,
        onConnect: () => {
          done();
        }
      });

      mockEventSource = service['eventSource'] as MockEventSource;

      // Simulate error
      const errorEvent = new Event('error');
      mockEventSource.onerror?.(errorEvent);

      // Should reconnect after delay
      setTimeout(() => {
        expect(service['eventSource']).toBeInstanceOf(MockEventSource);
      }, reconnectDelay + 50);
    });

    it('does not reconnect if disabled', (done) => {
      service.connect('/api/events', { reconnect: false });
      mockEventSource = service['eventSource'] as MockEventSource;
      const firstEventSource = mockEventSource;

      // Simulate error
      const errorEvent = new Event('error');
      mockEventSource.onerror?.(errorEvent);

      setTimeout(() => {
        expect(service['eventSource']).toBe(firstEventSource);
        done();
      }, 200);
    });
  });
});