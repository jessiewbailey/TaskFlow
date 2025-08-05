import { renderHook, act, waitFor } from '@testing-library/react';
import { useEventStream } from './useEventStream';

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
    
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  dispatchMessage(data: string) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  dispatchError() {
    this.readyState = 2; // CLOSED
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Replace global EventSource with mock
(global as any).EventSource = MockEventSource;

describe('useEventStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('connects to the event stream on mount', async () => {
    const { result } = renderHook(() => useEventStream('/api/events'));

    // Initially not connected
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionStatus).toBe('connecting');

    // Wait for connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionStatus).toBe('connected');
    });
  });

  it('processes incoming messages correctly', async () => {
    const { result } = renderHook(() => useEventStream('/api/events'));
    let eventSource: MockEventSource;

    // Wait for connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Get the EventSource instance
    act(() => {
      eventSource = (global as any).EventSource.mock.instances[0];
    });

    // Simulate incoming message
    act(() => {
      eventSource!.dispatchMessage(JSON.stringify({
        type: 'job_update',
        data: {
          request_id: 123,
          status: 'RUNNING',
          queue_position: 2,
        },
      }));
    });

    // Check if the message was processed
    expect(result.current.lastMessage).toEqual({
      type: 'job_update',
      data: {
        request_id: 123,
        status: 'RUNNING',
        queue_position: 2,
      },
    });
  });

  it('handles connection errors gracefully', async () => {
    const { result } = renderHook(() => useEventStream('/api/events'));
    let eventSource: MockEventSource;

    // Wait for initial connection attempt
    await waitFor(() => {
      eventSource = (global as any).EventSource.mock.instances[0];
      expect(eventSource).toBeDefined();
    });

    // Simulate error
    act(() => {
      eventSource!.dispatchError();
    });

    // Check error state
    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('error');
      expect(result.current.error).toBeTruthy();
    });
  });

  it('reconnects after connection loss', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useEventStream('/api/events', {
      reconnectInterval: 1000,
      maxReconnectAttempts: 3,
    }));

    // Wait for initial connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const firstEventSource = (global as any).EventSource.mock.instances[0];

    // Simulate connection error
    act(() => {
      firstEventSource.dispatchError();
    });

    // Verify disconnection
    expect(result.current.isConnected).toBe(false);
    expect(result.current.reconnectAttempts).toBe(0);

    // Fast-forward to trigger reconnection
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Should create a new EventSource
    await waitFor(() => {
      const instances = (global as any).EventSource.mock.instances;
      expect(instances.length).toBe(2);
      expect(result.current.reconnectAttempts).toBe(1);
    });

    jest.useRealTimers();
  });

  it('stops reconnecting after max attempts', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useEventStream('/api/events', {
      reconnectInterval: 100,
      maxReconnectAttempts: 2,
    }));

    // Simulate multiple connection failures
    for (let i = 0; i < 3; i++) {
      await waitFor(() => {
        const instances = (global as any).EventSource.mock.instances;
        expect(instances.length).toBeGreaterThan(i);
      });

      const eventSource = (global as any).EventSource.mock.instances[i];
      
      act(() => {
        eventSource.dispatchError();
        jest.advanceTimersByTime(100);
      });
    }

    // Should stop after max attempts
    await waitFor(() => {
      expect(result.current.reconnectAttempts).toBe(2);
      expect(result.current.connectionStatus).toBe('failed');
    });

    jest.useRealTimers();
  });

  it('cleans up on unmount', async () => {
    const { result, unmount } = renderHook(() => useEventStream('/api/events'));

    // Wait for connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const eventSource = (global as any).EventSource.mock.instances[0];

    // Unmount the hook
    unmount();

    // Verify cleanup
    expect(eventSource.close).toHaveBeenCalled();
  });

  it('handles malformed messages gracefully', async () => {
    const { result } = renderHook(() => useEventStream('/api/events'));
    let eventSource: MockEventSource;

    // Wait for connection
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      eventSource = (global as any).EventSource.mock.instances[0];
    });

    // Send malformed JSON
    act(() => {
      eventSource!.dispatchMessage('invalid json {');
    });

    // Should not crash, error should be set
    expect(result.current.error).toBeTruthy();
    expect(result.current.lastMessage).toBeNull();
  });

  it('filters messages by type when specified', async () => {
    const { result } = renderHook(() => 
      useEventStream('/api/events', {
        messageTypes: ['job_update'],
      })
    );

    let eventSource: MockEventSource;

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
      eventSource = (global as any).EventSource.mock.instances[0];
    });

    // Send message of allowed type
    act(() => {
      eventSource!.dispatchMessage(JSON.stringify({
        type: 'job_update',
        data: { status: 'RUNNING' },
      }));
    });

    expect(result.current.lastMessage?.type).toBe('job_update');

    // Send message of filtered type
    act(() => {
      eventSource!.dispatchMessage(JSON.stringify({
        type: 'other_event',
        data: { info: 'ignored' },
      }));
    });

    // Should still have the previous message
    expect(result.current.lastMessage?.type).toBe('job_update');
  });
});