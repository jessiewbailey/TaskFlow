# Real-Time Progress Tracking for TaskFlow

## Overview

TaskFlow now supports real-time progress tracking for both quick embedding generation (seconds) and long-running workflow jobs (minutes). Here's how it works:

## Event Timeline Example

### Quick Embedding Job (~2-5 seconds)
```
0.0s: job.started {job_type: "EMBEDDING"}
0.1s: embedding.progress {progress: 0.1, message: "Fetching request data"}
0.3s: embedding.progress {progress: 0.3, message: "Preparing text for embedding"}
0.5s: embedding.progress {progress: 0.5, message: "Generating embedding vector"}
0.8s: embedding.progress {progress: 0.8, message: "Storing embedding in vector database"}
0.95s: embedding.progress {progress: 0.95, message: "Finalizing embedding storage"}
1.0s: embedding.progress {progress: 1.0, message: "Embedding stored successfully"}
1.1s: job.completed {job_type: "EMBEDDING", embedding_id: "uuid-here"}
```

### Long Workflow Job (3-5 minutes)
```
0s: job.started {job_type: "WORKFLOW", workflow_id: 1}
0s: workflow.started {workflow_id: 1}

# Step 1: Summarize Text (30-45 seconds)
1s: job.progress {progress: 0.0, message: "Step 1/4: Summarize Text ..."}
45s: workflow.step.completed {step_name: "Summarize Text", result: {...}}
45s: job.progress {progress: 0.25, message: "Step 1/4: Summarize Text ✓"}

# Step 2: Extract Entities (45-60 seconds)
46s: job.progress {progress: 0.25, message: "Step 2/4: Extract Entities ..."}
105s: workflow.step.completed {step_name: "Extract Entities", result: {...}}
105s: job.progress {progress: 0.50, message: "Step 2/4: Extract Entities ✓"}

# Step 3: Analyze Sentiment (30-45 seconds)
106s: job.progress {progress: 0.50, message: "Step 3/4: Analyze Sentiment ..."}
150s: workflow.step.completed {step_name: "Analyze Sentiment", result: {...}}
150s: job.progress {progress: 0.75, message: "Step 3/4: Analyze Sentiment ✓"}

# Step 4: Generate Report (60-90 seconds)
151s: job.progress {progress: 0.75, message: "Step 4/4: Generate Report ..."}
240s: workflow.step.completed {step_name: "Generate Report", result: {...}}
240s: job.progress {progress: 1.0, message: "Step 4/4: Generate Report ✓"}

241s: workflow.completed {workflow_id: 1, version: 1}
241s: job.completed {job_type: "WORKFLOW", version: 1}
```

## Frontend Implementation

### 1. Job Status Component with Progress

```javascript
function JobStatus({ request }) {
  const [jobStatus, setJobStatus] = useState(request.jobStatus);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentStep, setCurrentStep] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/requests/${request.id}/events`);
    const startTime = Date.now();
    
    // Update elapsed time every second
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    eventSource.addEventListener('job.progress', (e) => {
      const data = JSON.parse(e.data);
      setProgress(data.payload.progress);
      setProgressMessage(data.payload.message);
      
      // Extract step info from message
      const stepMatch = data.payload.message.match(/Step (\d+)\/(\d+): (.*)/);
      if (stepMatch) {
        setCurrentStep(`${stepMatch[3]} (${stepMatch[1]}/${stepMatch[2]})`);
      }
    });
    
    eventSource.addEventListener('job.completed', (e) => {
      setJobStatus('COMPLETED');
      setProgress(1);
      clearInterval(timer);
    });
    
    eventSource.addEventListener('job.failed', (e) => {
      setJobStatus('FAILED');
      clearInterval(timer);
    });
    
    return () => {
      eventSource.close();
      clearInterval(timer);
    };
  }, [request.id]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (jobStatus === 'COMPLETED') {
    return <div className="status-complete">✓ Completed</div>;
  }
  
  if (jobStatus === 'FAILED') {
    return <div className="status-failed">✗ Failed</div>;
  }
  
  return (
    <div className="job-progress">
      <div className="progress-header">
        <span className="status-processing">⟳ Processing...</span>
        <span className="elapsed-time">{formatTime(elapsedTime)}</span>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress * 100}%` }}
        />
        <span className="progress-percent">{Math.round(progress * 100)}%</span>
      </div>
      
      {currentStep && (
        <div className="current-step">
          {progressMessage}
        </div>
      )}
    </div>
  );
}
```

### 2. Dashboard with Mixed Job Types

```javascript
function TaskFlowDashboard() {
  const [requests, setRequests] = useState([]);
  
  useEffect(() => {
    // Connect to all visible requests
    requests.forEach(request => {
      const eventSource = new EventSource(`/api/requests/${request.id}/events`);
      
      // Handle different job types
      eventSource.addEventListener('job.completed', (e) => {
        const data = JSON.parse(e.data);
        
        // Update the specific request
        setRequests(prev => prev.map(req => 
          req.id === request.id 
            ? { ...req, status: 'COMPLETED', lastUpdated: new Date() }
            : req
        ));
        
        // Show notification based on job type
        if (data.payload.job_type === 'WORKFLOW') {
          showNotification(`Workflow completed for request #${request.id} (took ${data.payload.duration})`);
        } else if (data.payload.job_type === 'EMBEDDING') {
          showNotification(`Embedding generated for request #${request.id}`);
        }
      });
    });
  }, [requests]);
  
  return (
    <div className="dashboard">
      {requests.map(request => (
        <RequestCard key={request.id} request={request}>
          <JobStatus request={request} />
        </RequestCard>
      ))}
    </div>
  );
}
```

### 3. Detailed Progress Modal

```javascript
function WorkflowProgressModal({ requestId, onClose }) {
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/requests/${requestId}/events`);
    
    eventSource.addEventListener('workflow.started', (e) => {
      const data = JSON.parse(e.data);
      // Could fetch workflow structure here
    });
    
    eventSource.addEventListener('workflow.step.completed', (e) => {
      const data = JSON.parse(e.data);
      setSteps(prev => [...prev, {
        name: data.payload.step_name,
        result: data.payload.result,
        completedAt: new Date()
      }]);
    });
    
    eventSource.addEventListener('job.progress', (e) => {
      const data = JSON.parse(e.data);
      const stepMatch = data.payload.message.match(/Step \d+\/\d+: (.*?) (\.\.\.|\✓)/);
      if (stepMatch) {
        setCurrentStep({
          name: stepMatch[1],
          inProgress: stepMatch[2] === '...'
        });
      }
    });
    
    return () => eventSource.close();
  }, [requestId]);
  
  return (
    <div className="progress-modal">
      <h3>Workflow Progress</h3>
      
      <div className="step-list">
        {steps.map((step, idx) => (
          <div key={idx} className="step-item completed">
            <span className="step-icon">✓</span>
            <span className="step-name">{step.name}</span>
            <span className="step-time">{step.completedAt.toLocaleTimeString()}</span>
          </div>
        ))}
        
        {currentStep && currentStep.inProgress && (
          <div className="step-item in-progress">
            <span className="step-icon spinner">⟳</span>
            <span className="step-name">{currentStep.name}</span>
            <span className="step-status">Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

## CSS for Progress UI

```css
.job-progress {
  margin: 10px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.elapsed-time {
  color: #666;
  font-size: 14px;
}

.progress-bar {
  position: relative;
  height: 24px;
  background: #e0e0e0;
  border-radius: 12px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50, #66BB6A);
  transition: width 0.3s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.progress-percent {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: bold;
  color: #333;
  text-shadow: 0 1px 2px rgba(255,255,255,0.8);
}

.current-step {
  margin-top: 8px;
  font-size: 14px;
  color: #666;
  font-style: italic;
}

/* Step list in modal */
.step-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.step-item.completed {
  color: #4CAF50;
}

.step-item.in-progress {
  color: #2196F3;
  background: #E3F2FD;
}

.step-icon {
  margin-right: 10px;
  font-size: 20px;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Time estimates */
.time-estimate {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

/* Notification style */
.notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #323232;
  color: white;
  padding: 16px 24px;
  border-radius: 4px;
  box-shadow: 0 3px 5px rgba(0,0,0,0.3);
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

## Key Benefits

1. **User Experience**
   - No more refreshing to see status
   - Visual progress for long operations
   - Time estimates based on progress
   - Clear indication of current step

2. **Performance**
   - Only active requests maintain SSE connections
   - Automatic cleanup when components unmount
   - Efficient event filtering

3. **Flexibility**
   - Works for both quick and long jobs
   - Easy to add new event types
   - Can show different UI based on job type