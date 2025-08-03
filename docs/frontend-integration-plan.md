# TaskFlow Frontend Real-Time Integration Plan

## Overview

This document provides a complete implementation plan for integrating the real-time event system into the TaskFlow frontend. The backend is ready and sending events - this plan shows how to consume them in the UI.

## Current Backend Capabilities

### Available SSE Endpoint
```
GET /api/requests/{request_id}/events
```

### Event Types Being Sent
```javascript
// Job lifecycle events
- job.started         { job_type, job_id }
- job.progress        { progress: 0-1, message }
- job.completed       { job_type, result }
- job.failed          { job_type, error }

// Embedding events
- embedding.started   { }
- embedding.progress  { status, progress, message }
- embedding.completed { embedding_id }
- embedding.failed    { error }

// Workflow events
- workflow.started         { workflow_id }
- workflow.step.completed  { step_name, result }
- workflow.completed       { workflow_id, version }
- workflow.failed          { error }

// Status events
- status              { request_id, status, embedding_status }
```

## Phase 1: Core Infrastructure (Day 1)

### 1.1 Create Event Management Service
**File: `frontend/src/services/EventStreamService.js`**

```javascript
// Singleton service to manage all SSE connections
class EventStreamService {
  constructor() {
    this.connections = new Map();      // requestId -> EventSource
    this.listeners = new Map();        // event -> Set<callbacks>
    this.reconnectAttempts = new Map(); // requestId -> count
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
  }

  connect(requestId) {
    // Prevent duplicate connections
    if (this.connections.has(requestId)) {
      return this.connections.get(requestId);
    }

    const eventSource = new EventSource(`/api/requests/${requestId}/events`);
    
    // Set up event handlers
    this._setupEventHandlers(eventSource, requestId);
    
    this.connections.set(requestId, eventSource);
    this.reconnectAttempts.set(requestId, 0);
    
    return eventSource;
  }

  disconnect(requestId) {
    const eventSource = this.connections.get(requestId);
    if (eventSource) {
      eventSource.close();
      this.connections.delete(requestId);
      this.reconnectAttempts.delete(requestId);
    }
  }

  _setupEventHandlers(eventSource, requestId) {
    // Handle all event types
    const eventTypes = [
      'job.started', 'job.progress', 'job.completed', 'job.failed',
      'embedding.progress', 'embedding.completed',
      'workflow.started', 'workflow.step.completed', 'workflow.completed',
      'status'
    ];

    eventTypes.forEach(eventType => {
      eventSource.addEventListener(eventType, (event) => {
        const data = JSON.parse(event.data);
        this._notifyListeners(eventType, { requestId, ...data });
      });
    });

    // Handle connection errors with exponential backoff
    eventSource.onerror = () => {
      this._handleConnectionError(requestId);
    };

    // Handle successful connection
    eventSource.onopen = () => {
      console.log(`SSE connected for request ${requestId}`);
      this.reconnectAttempts.set(requestId, 0);
    };
  }

  _handleConnectionError(requestId) {
    const attempts = this.reconnectAttempts.get(requestId) || 0;
    
    if (attempts < this.maxReconnectAttempts) {
      const delay = this.reconnectDelay * Math.pow(2, attempts);
      console.log(`SSE reconnecting for request ${requestId} in ${delay}ms (attempt ${attempts + 1})`);
      
      setTimeout(() => {
        this.disconnect(requestId);
        this.connect(requestId);
        this.reconnectAttempts.set(requestId, attempts + 1);
      }, delay);
    } else {
      console.error(`SSE max reconnection attempts reached for request ${requestId}`);
      this._notifyListeners('connection.failed', { requestId });
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  _notifyListeners(eventType, data) {
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
  }

  // Utility method to connect to multiple requests
  connectToRequests(requestIds) {
    requestIds.forEach(id => this.connect(id));
  }

  // Disconnect from all
  disconnectAll() {
    this.connections.forEach((_, requestId) => this.disconnect(requestId));
  }
}

export default new EventStreamService();
```

### 1.2 Create React Hooks for Easy Integration
**File: `frontend/src/hooks/useRequestEvents.js`**

```javascript
import { useEffect, useRef } from 'react';
import EventStreamService from '../services/EventStreamService';

export function useRequestEvents(requestId, handlers = {}) {
  const unsubscribers = useRef([]);

  useEffect(() => {
    if (!requestId) return;

    // Connect to SSE
    EventStreamService.connect(requestId);

    // Subscribe to events
    Object.entries(handlers).forEach(([eventType, handler]) => {
      const unsubscribe = EventStreamService.on(eventType, (data) => {
        if (data.requestId === requestId) {
          handler(data);
        }
      });
      unsubscribers.current.push(unsubscribe);
    });

    // Cleanup
    return () => {
      unsubscribers.current.forEach(unsub => unsub());
      unsubscribers.current = [];
      EventStreamService.disconnect(requestId);
    };
  }, [requestId, handlers]);
}
```

**File: `frontend/src/hooks/useRequestProgress.js`**

```javascript
import { useState, useEffect } from 'react';
import { useRequestEvents } from './useRequestEvents';

export function useRequestProgress(requestId) {
  const [progress, setProgress] = useState({
    status: 'PENDING',
    percentage: 0,
    message: '',
    currentStep: null,
    completedSteps: [],
    error: null,
    startTime: null,
    endTime: null
  });

  useRequestEvents(requestId, {
    'job.started': (data) => {
      setProgress(prev => ({
        ...prev,
        status: 'RUNNING',
        startTime: new Date()
      }));
    },
    
    'job.progress': (data) => {
      setProgress(prev => ({
        ...prev,
        percentage: data.payload.progress * 100,
        message: data.payload.message
      }));
    },
    
    'workflow.step.completed': (data) => {
      setProgress(prev => ({
        ...prev,
        completedSteps: [...prev.completedSteps, {
          name: data.payload.step_name,
          completedAt: new Date()
        }]
      }));
    },
    
    'job.completed': (data) => {
      setProgress(prev => ({
        ...prev,
        status: 'COMPLETED',
        percentage: 100,
        endTime: new Date()
      }));
    },
    
    'job.failed': (data) => {
      setProgress(prev => ({
        ...prev,
        status: 'FAILED',
        error: data.payload.error,
        endTime: new Date()
      }));
    }
  });

  return progress;
}
```

## Phase 2: UI Components (Day 2)

### 2.1 Progress Bar Component
**File: `frontend/src/components/ProgressBar.jsx`**

```jsx
import React from 'react';
import './ProgressBar.css';

export function ProgressBar({ progress, message, showTime = true }) {
  const getElapsedTime = () => {
    if (!progress.startTime) return '';
    
    const elapsed = progress.endTime 
      ? new Date(progress.endTime) - new Date(progress.startTime)
      : new Date() - new Date(progress.startTime);
    
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'COMPLETED': return '✓';
      case 'FAILED': return '✗';
      case 'RUNNING': return '⟳';
      default: return '○';
    }
  };

  return (
    <div className={`progress-container ${progress.status.toLowerCase()}`}>
      <div className="progress-header">
        <span className="progress-status">
          <span className="status-icon">{getStatusIcon()}</span>
          {progress.status}
        </span>
        {showTime && progress.startTime && (
          <span className="elapsed-time">{getElapsedTime()}</span>
        )}
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${progress.percentage}%` }}
        >
          <span className="progress-percentage">
            {Math.round(progress.percentage)}%
          </span>
        </div>
      </div>
      
      {progress.message && (
        <div className="progress-message">{progress.message}</div>
      )}
      
      {progress.error && (
        <div className="progress-error">Error: {progress.error}</div>
      )}
    </div>
  );
}
```

### 2.2 Request Card with Live Updates
**File: `frontend/src/components/RequestCard.jsx`**

```jsx
import React from 'react';
import { useRequestProgress } from '../hooks/useRequestProgress';
import { ProgressBar } from './ProgressBar';
import './RequestCard.css';

export function RequestCard({ request, onUpdate }) {
  const progress = useRequestProgress(request.id);
  
  // Notify parent when status changes
  React.useEffect(() => {
    if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
      onUpdate?.(request.id, progress.status);
    }
  }, [progress.status, request.id, onUpdate]);

  const isProcessing = progress.status === 'RUNNING';
  const isComplete = progress.status === 'COMPLETED';
  const isFailed = progress.status === 'FAILED';

  return (
    <div className={`request-card ${progress.status.toLowerCase()}`}>
      <div className="request-header">
        <h3>Request #{request.id}</h3>
        <span className={`status-badge ${progress.status.toLowerCase()}`}>
          {progress.status}
        </span>
      </div>
      
      <div className="request-info">
        <p className="request-text">{request.text}</p>
        <div className="request-meta">
          <span>By: {request.requester}</span>
          <span>Created: {new Date(request.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      
      {(isProcessing || isComplete || isFailed) && (
        <ProgressBar progress={progress} />
      )}
      
      {progress.completedSteps.length > 0 && (
        <div className="completed-steps">
          <h4>Completed Steps:</h4>
          <ul>
            {progress.completedSteps.map((step, idx) => (
              <li key={idx}>
                ✓ {step.name} 
                <span className="step-time">
                  ({new Date(step.completedAt).toLocaleTimeString()})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

### 2.3 Dashboard Integration
**File: `frontend/src/pages/Dashboard.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { RequestCard } from '../components/RequestCard';
import EventStreamService from '../services/EventStreamService';
import './Dashboard.css';

export function Dashboard() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('all'); // all, processing, completed

  // Fetch initial requests
  useEffect(() => {
    fetchRequests();
  }, []);

  // Set up global event listener for any completions
  useEffect(() => {
    const unsubscribe = EventStreamService.on('job.completed', (data) => {
      // Refresh the specific request data
      fetchRequest(data.requestId);
      
      // Show notification
      showNotification(`Request #${data.requestId} completed!`);
    });

    return unsubscribe;
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/requests');
      const data = await response.json();
      setRequests(data.requests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    }
  };

  const fetchRequest = async (requestId) => {
    try {
      const response = await fetch(`/api/requests/${requestId}`);
      const data = await response.json();
      
      setRequests(prev => prev.map(req => 
        req.id === requestId ? data : req
      ));
    } catch (error) {
      console.error(`Failed to fetch request ${requestId}:`, error);
    }
  };

  const handleRequestUpdate = (requestId, status) => {
    // Update local state optimistically
    setRequests(prev => prev.map(req => 
      req.id === requestId ? { ...req, status } : req
    ));
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    if (filter === 'processing') return req.status === 'NEW' || req.status === 'PROCESSING';
    if (filter === 'completed') return req.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>TaskFlow Dashboard</h1>
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All ({requests.length})
          </button>
          <button 
            className={filter === 'processing' ? 'active' : ''}
            onClick={() => setFilter('processing')}
          >
            Processing ({requests.filter(r => r.status === 'NEW' || r.status === 'PROCESSING').length})
          </button>
          <button 
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            Completed ({requests.filter(r => r.status === 'COMPLETED').length})
          </button>
        </div>
      </div>
      
      <div className="request-grid">
        {filteredRequests.map(request => (
          <RequestCard 
            key={request.id} 
            request={request}
            onUpdate={handleRequestUpdate}
          />
        ))}
      </div>
    </div>
  );
}
```

## Phase 3: Advanced Features (Day 3)

### 3.1 Detailed Progress Modal
**File: `frontend/src/components/WorkflowProgressModal.jsx`**

```jsx
import React, { useState } from 'react';
import { useRequestEvents } from '../hooks/useRequestEvents';
import './WorkflowProgressModal.css';

export function WorkflowProgressModal({ requestId, onClose }) {
  const [workflow, setWorkflow] = useState({
    name: '',
    totalSteps: 0,
    currentStep: 0,
    steps: []
  });

  useRequestEvents(requestId, {
    'workflow.started': async (data) => {
      // Fetch workflow details
      const response = await fetch(`/api/workflows/${data.payload.workflow_id}`);
      const workflowData = await response.json();
      
      setWorkflow({
        name: workflowData.name,
        totalSteps: workflowData.blocks.length,
        currentStep: 0,
        steps: workflowData.blocks.map(block => ({
          name: block.name,
          status: 'pending',
          result: null
        }))
      });
    },
    
    'job.progress': (data) => {
      const stepMatch = data.payload.message.match(/Step (\d+)\/\d+: (.*?) (\.\.\.|\✓)/);
      if (stepMatch) {
        const stepNumber = parseInt(stepMatch[1]);
        const isComplete = stepMatch[3] === '✓';
        
        setWorkflow(prev => ({
          ...prev,
          currentStep: stepNumber,
          steps: prev.steps.map((step, idx) => {
            if (idx === stepNumber - 1) {
              return {
                ...step,
                status: isComplete ? 'completed' : 'running'
              };
            }
            return step;
          })
        }));
      }
    },
    
    'workflow.step.completed': (data) => {
      setWorkflow(prev => ({
        ...prev,
        steps: prev.steps.map(step => 
          step.name === data.payload.step_name
            ? { ...step, status: 'completed', result: data.payload.result }
            : step
        )
      }));
    }
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Workflow Progress: {workflow.name}</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="workflow-progress">
          <div className="progress-summary">
            Step {workflow.currentStep} of {workflow.totalSteps}
          </div>
          
          <div className="steps-timeline">
            {workflow.steps.map((step, idx) => (
              <div key={idx} className={`timeline-step ${step.status}`}>
                <div className="step-connector" />
                <div className="step-bubble">
                  {step.status === 'completed' ? '✓' :
                   step.status === 'running' ? '⟳' : 
                   idx + 1}
                </div>
                <div className="step-content">
                  <h4>{step.name}</h4>
                  {step.status === 'running' && (
                    <div className="step-spinner">Processing...</div>
                  )}
                  {step.result && (
                    <details className="step-result">
                      <summary>View Result</summary>
                      <pre>{JSON.stringify(step.result, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 3.2 Notification System
**File: `frontend/src/components/NotificationSystem.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import EventStreamService from '../services/EventStreamService';
import './NotificationSystem.css';

export function NotificationSystem() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handlers = {
      'job.completed': (data) => {
        addNotification({
          type: 'success',
          title: 'Job Completed',
          message: `Request #${data.requestId} has been processed successfully`,
          requestId: data.requestId
        });
      },
      
      'job.failed': (data) => {
        addNotification({
          type: 'error',
          title: 'Job Failed',
          message: `Request #${data.requestId} failed: ${data.payload.error}`,
          requestId: data.requestId
        });
      },
      
      'connection.failed': (data) => {
        addNotification({
          type: 'warning',
          title: 'Connection Lost',
          message: `Lost real-time connection for request #${data.requestId}`,
          requestId: data.requestId
        });
      }
    };

    const unsubscribers = Object.entries(handlers).map(([event, handler]) => 
      EventStreamService.on(event, handler)
    );

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const addNotification = (notification) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <div 
          key={notification.id} 
          className={`notification ${notification.type}`}
          onClick={() => removeNotification(notification.id)}
        >
          <h4>{notification.title}</h4>
          <p>{notification.message}</p>
        </div>
      ))}
    </div>
  );
}
```

## Phase 4: CSS Styling

### 4.1 Core Progress Styles
**File: `frontend/src/components/ProgressBar.css`**

```css
.progress-container {
  margin: 15px 0;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  transition: all 0.3s ease;
}

.progress-container.completed {
  background: #e8f5e9;
  border-color: #4caf50;
}

.progress-container.failed {
  background: #ffebee;
  border-color: #f44336;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-status {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: #333;
}

.status-icon {
  margin-right: 8px;
  font-size: 18px;
}

.running .status-icon {
  animation: spin 1s linear infinite;
  color: #2196f3;
}

.completed .status-icon {
  color: #4caf50;
}

.failed .status-icon {
  color: #f44336;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.elapsed-time {
  color: #666;
  font-size: 14px;
  font-family: monospace;
}

.progress-bar {
  position: relative;
  height: 28px;
  background: #e0e0e0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2196f3, #42a5f5);
  transition: width 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.completed .progress-fill {
  background: linear-gradient(90deg, #4caf50, #66bb6a);
}

.failed .progress-fill {
  background: linear-gradient(90deg, #f44336, #ef5350);
}

.progress-percentage {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: #333;
  font-weight: 600;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(255,255,255,0.8);
}

.progress-message {
  margin-top: 10px;
  font-size: 14px;
  color: #666;
  font-style: italic;
}

.progress-error {
  margin-top: 10px;
  font-size: 14px;
  color: #f44336;
  background: #ffebee;
  padding: 8px 12px;
  border-radius: 4px;
}
```

### 4.2 Request Card Styles
**File: `frontend/src/components/RequestCard.css`**

```css
.request-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  padding: 20px;
  transition: all 0.3s ease;
  border: 2px solid transparent;
}

.request-card.running {
  border-color: #2196f3;
  box-shadow: 0 4px 12px rgba(33,150,243,0.2);
}

.request-card.completed {
  border-color: #4caf50;
}

.request-card.failed {
  border-color: #f44336;
}

.request-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.request-header h3 {
  margin: 0;
  color: #333;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.status-badge.new {
  background: #e3f2fd;
  color: #1976d2;
}

.status-badge.running {
  background: #e1f5fe;
  color: #0277bd;
}

.status-badge.completed {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.failed {
  background: #ffebee;
  color: #c62828;
}

.request-info {
  margin-bottom: 15px;
}

.request-text {
  color: #555;
  margin: 10px 0;
  line-height: 1.5;
}

.request-meta {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #999;
}

.completed-steps {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #e0e0e0;
}

.completed-steps h4 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
}

.completed-steps ul {
  margin: 0;
  padding-left: 20px;
}

.completed-steps li {
  color: #4caf50;
  margin: 5px 0;
}

.step-time {
  color: #999;
  font-size: 12px;
  margin-left: 10px;
}
```

## Phase 5: Implementation Steps

### Day 1: Infrastructure
1. **Morning**: 
   - Set up EventStreamService
   - Test connection to backend SSE endpoint
   - Verify events are being received

2. **Afternoon**:
   - Create basic hooks (useRequestEvents, useRequestProgress)
   - Test with console.log to ensure events flow correctly

### Day 2: Basic UI
1. **Morning**:
   - Implement ProgressBar component
   - Integrate into existing request display

2. **Afternoon**:
   - Update RequestCard with live updates
   - Test with a long-running workflow

### Day 3: Advanced Features
1. **Morning**:
   - Build WorkflowProgressModal
   - Add notification system

2. **Afternoon**:
   - Polish UI/UX
   - Handle edge cases (connection loss, errors)

### Day 4: Testing & Polish
1. **Morning**:
   - Test with multiple simultaneous requests
   - Test connection recovery

2. **Afternoon**:
   - Performance optimization
   - Documentation

## Testing Checklist

### Unit Tests
```javascript
// EventStreamService.test.js
describe('EventStreamService', () => {
  it('should connect to SSE endpoint', () => {
    const requestId = 123;
    EventStreamService.connect(requestId);
    expect(EventStreamService.connections.has(requestId)).toBe(true);
  });

  it('should handle reconnection on error', async () => {
    // Test exponential backoff
  });

  it('should notify listeners of events', () => {
    const callback = jest.fn();
    EventStreamService.on('job.completed', callback);
    // Trigger event
    expect(callback).toHaveBeenCalled();
  });
});
```

### Integration Tests
1. Create a request and verify real-time updates appear
2. Test with slow network connection
3. Test with server restart during processing
4. Test with multiple tabs open

### Performance Tests
1. Monitor memory usage with 50+ active connections
2. Verify cleanup on component unmount
3. Test with rapid mount/unmount cycles

## Debugging Tips

### Browser DevTools
```javascript
// In console, monitor all events
window.eventDebug = true;
EventStreamService.on('*', (event) => {
  if (window.eventDebug) {
    console.log('SSE Event:', event);
  }
});
```

### Check SSE Connection
```javascript
// In console
const es = new EventSource('/api/requests/123/events');
es.onmessage = e => console.log('Raw SSE:', e.data);
es.onerror = e => console.error('SSE Error:', e);
```

## Common Issues & Solutions

### Issue: Events not received
**Solution**: Check CORS, check backend logs, verify SSE endpoint

### Issue: Too many connections
**Solution**: Implement connection pooling, limit per page

### Issue: Memory leaks
**Solution**: Ensure proper cleanup in useEffect returns

### Issue: Duplicate events
**Solution**: Use request ID filtering in event handlers

## Migration Guide

### From Polling to SSE
```javascript
// Old polling code
useEffect(() => {
  const interval = setInterval(() => {
    fetchRequestStatus(requestId);
  }, 5000);
  return () => clearInterval(interval);
}, [requestId]);

// New SSE code
useRequestEvents(requestId, {
  'status': (data) => {
    updateRequestStatus(data.payload);
  }
});
```

## Performance Considerations

1. **Connection Limits**: Browsers limit ~6 SSE connections per domain
2. **Memory Usage**: Each connection uses ~10-50KB
3. **CPU Usage**: Minimal, events are push-based
4. **Network**: Very efficient, keeps connection open

## Security Considerations

1. **Authentication**: SSE inherits cookies/auth headers
2. **CORS**: Configure for your domain
3. **Rate Limiting**: Implement on backend
4. **Input Validation**: Validate all event data

## Next Steps

1. Implement Phase 1 (Core Infrastructure)
2. Test with real backend
3. Implement Phase 2 (Basic UI)
4. Get user feedback
5. Implement Phase 3 (Advanced Features)
6. Performance optimization
7. Deploy to production