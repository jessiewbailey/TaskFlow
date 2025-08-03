# Frontend SSE Integration Guide

## Overview

The backend provides Server-Sent Events (SSE) for real-time updates. Here's how to integrate them into the TaskFlow UI.

## 1. Global Event Manager (React Example)

```typescript
// services/EventStreamManager.ts
export class EventStreamManager {
  private connections: Map<number, EventSource> = new Map();
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  // Connect to SSE for a specific request
  connectToRequest(requestId: number) {
    if (this.connections.has(requestId)) return;

    const eventSource = new EventSource(`/api/requests/${requestId}/events`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.notifyListeners(`request.${requestId}`, data);
      this.notifyListeners(`request.*.${data.type}`, { requestId, ...data });
    };

    eventSource.addEventListener('job.completed', (event) => {
      const data = JSON.parse(event.data);
      this.notifyListeners('job.completed', { requestId, ...data });
    });

    eventSource.addEventListener('embedding.progress', (event) => {
      const data = JSON.parse(event.data);
      this.notifyListeners('embedding.progress', { requestId, ...data });
    });

    eventSource.onerror = () => {
      console.error(`SSE connection error for request ${requestId}`);
      // Implement reconnection logic here
    };

    this.connections.set(requestId, eventSource);
  }

  // Disconnect from a request's events
  disconnectFromRequest(requestId: number) {
    const connection = this.connections.get(requestId);
    if (connection) {
      connection.close();
      this.connections.delete(requestId);
    }
  }

  // Subscribe to events
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private notifyListeners(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }
}

export const eventManager = new EventStreamManager();
```

## 2. React Hook for Real-time Updates

```typescript
// hooks/useRequestUpdates.ts
import { useEffect, useState } from 'react';
import { eventManager } from '../services/EventStreamManager';

export function useRequestUpdates(requestId: number) {
  const [status, setStatus] = useState<string>();
  const [embeddingStatus, setEmbeddingStatus] = useState<string>();
  const [progress, setProgress] = useState<number>(0);
  const [jobStatus, setJobStatus] = useState<string>('PENDING');

  useEffect(() => {
    // Connect to SSE
    eventManager.connectToRequest(requestId);

    // Subscribe to events
    const unsubscribers = [
      eventManager.on(`request.${requestId}`, (data) => {
        if (data.type === 'status' && data.payload) {
          setStatus(data.payload.status);
          setEmbeddingStatus(data.payload.embedding_status);
        }
      }),
      
      eventManager.on('job.completed', (data) => {
        if (data.requestId === requestId) {
          setJobStatus('COMPLETED');
          // Trigger data refresh
          window.dispatchEvent(new CustomEvent('request-updated', { 
            detail: { requestId } 
          }));
        }
      }),
      
      eventManager.on('embedding.progress', (data) => {
        if (data.requestId === requestId) {
          setProgress(data.payload.progress || 0);
        }
      })
    ];

    // Cleanup
    return () => {
      unsubscribers.forEach(unsub => unsub());
      eventManager.disconnectFromRequest(requestId);
    };
  }, [requestId]);

  return { status, embeddingStatus, progress, jobStatus };
}
```

## 3. Dashboard Integration

```typescript
// components/RequestCard.tsx
import { useRequestUpdates } from '../hooks/useRequestUpdates';

export function RequestCard({ request }: { request: Request }) {
  const { status, embeddingStatus, progress, jobStatus } = useRequestUpdates(request.id);

  return (
    <div className="request-card">
      <h3>Request #{request.id}</h3>
      
      {/* Real-time status updates */}
      <div className="status-badge">
        {jobStatus === 'COMPLETED' ? (
          <span className="badge-success">✓ Complete</span>
        ) : (
          <span className="badge-processing">⟳ Processing...</span>
        )}
      </div>

      {/* Embedding progress bar */}
      {embeddingStatus === 'PROCESSING' && (
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress * 100}%` }}
          />
          <span>{Math.round(progress * 100)}%</span>
        </div>
      )}

      {/* Auto-update status */}
      <div className="request-status">
        Status: {status || request.status}
      </div>
    </div>
  );
}
```

## 4. Dashboard List with Auto-refresh

```typescript
// components/Dashboard.tsx
import { useEffect, useState } from 'react';
import { eventManager } from '../services/EventStreamManager';

export function Dashboard() {
  const [requests, setRequests] = useState<Request[]>([]);
  
  // Connect to all visible requests
  useEffect(() => {
    requests.forEach(req => {
      eventManager.connectToRequest(req.id);
    });

    // Listen for any job completions
    const unsubscribe = eventManager.on('job.completed', (data) => {
      // Refresh the specific request
      fetchRequest(data.requestId).then(updated => {
        setRequests(prev => 
          prev.map(req => req.id === updated.id ? updated : req)
        );
      });
    });

    return () => {
      unsubscribe();
      requests.forEach(req => {
        eventManager.disconnectFromRequest(req.id);
      });
    };
  }, [requests]);

  return (
    <div className="dashboard">
      {requests.map(request => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}
```

## 5. Alternative: Polling Fallback

If SSE is not available or for simpler implementation:

```typescript
// hooks/useAutoRefresh.ts
export function useAutoRefresh(fetchData: () => Promise<void>, interval = 5000) {
  useEffect(() => {
    // Only poll if document is visible
    const timer = setInterval(() => {
      if (!document.hidden) {
        fetchData();
      }
    }, interval);

    // Also refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchData();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, interval]);
}
```

## 6. Vue.js Example

```vue
<!-- RequestStatus.vue -->
<template>
  <div class="request-status">
    <div v-if="isProcessing" class="processing">
      ⟳ Processing... {{ progressPercent }}%
      <div class="progress-bar">
        <div :style="{ width: progressPercent + '%' }" />
      </div>
    </div>
    <div v-else-if="isCompleted" class="completed">
      ✓ Completed
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue';

const props = defineProps(['requestId']);

const status = ref('PENDING');
const progress = ref(0);
let eventSource = null;

const isProcessing = computed(() => status.value === 'RUNNING');
const isCompleted = computed(() => status.value === 'COMPLETED');
const progressPercent = computed(() => Math.round(progress.value * 100));

onMounted(() => {
  eventSource = new EventSource(`/api/requests/${props.requestId}/events`);
  
  eventSource.addEventListener('job.progress', (event) => {
    const data = JSON.parse(event.data);
    progress.value = data.payload.progress || 0;
  });
  
  eventSource.addEventListener('job.completed', (event) => {
    status.value = 'COMPLETED';
    // Emit event to parent
    emit('completed');
  });
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>
```

## Best Practices

1. **Connection Management**
   - Connect when component mounts
   - Disconnect when component unmounts
   - Implement reconnection logic

2. **Performance**
   - Limit concurrent SSE connections
   - Use a single connection for multiple events
   - Disconnect from invisible tabs

3. **Error Handling**
   - Implement exponential backoff for reconnections
   - Fall back to polling if SSE fails
   - Show connection status to users

4. **State Management**
   - Update local state optimistically
   - Sync with server state via events
   - Handle out-of-order events

## Testing SSE in Development

```javascript
// Test SSE connection in browser console
const eventSource = new EventSource('/api/requests/36/events');
eventSource.onmessage = (e) => console.log('Event:', JSON.parse(e.data));
eventSource.addEventListener('job.completed', (e) => 
  console.log('Job completed!', JSON.parse(e.data))
);
```