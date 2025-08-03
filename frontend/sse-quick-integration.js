// Quick SSE Integration for TaskFlow Dashboard
// Add this to your existing dashboard code

class TaskFlowRealTimeUpdates {
  constructor() {
    this.connections = new Map();
    this.updateCallbacks = new Map();
  }

  // Call this when dashboard loads
  initDashboard() {
    // Find all request/job cards on the page
    const requestCards = document.querySelectorAll('[data-request-id]');
    
    requestCards.forEach(card => {
      const requestId = card.getAttribute('data-request-id');
      this.connectToRequest(requestId, (event) => {
        this.updateRequestCard(card, event);
      });
    });
  }

  // Connect to SSE for a specific request
  connectToRequest(requestId, callback) {
    if (this.connections.has(requestId)) return;

    const eventSource = new EventSource(`/api/requests/${requestId}/events`);
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      callback(data);
    };

    eventSource.addEventListener('job.completed', (event) => {
      const data = JSON.parse(event.data);
      // Update the UI immediately
      this.markRequestComplete(requestId);
      callback({ type: 'job.completed', ...data });
    });

    eventSource.addEventListener('embedding.progress', (event) => {
      const data = JSON.parse(event.data);
      this.updateProgress(requestId, data.payload.progress);
    });

    this.connections.set(requestId, eventSource);
  }

  // Update request card based on event
  updateRequestCard(card, event) {
    if (event.type === 'job.completed') {
      // Change "Processing..." to "Completed"
      const statusElement = card.querySelector('.status, .job-status');
      if (statusElement) {
        statusElement.textContent = 'Completed';
        statusElement.classList.remove('processing', 'pending');
        statusElement.classList.add('completed', 'success');
      }

      // Remove any spinning icons
      const spinner = card.querySelector('.spinner, .loading-icon');
      if (spinner) spinner.remove();

      // Add completion checkmark
      if (!card.querySelector('.complete-icon')) {
        const icon = document.createElement('span');
        icon.className = 'complete-icon';
        icon.textContent = '✓';
        statusElement?.appendChild(icon);
      }
    }
  }

  // Update progress bar
  updateProgress(requestId, progress) {
    const card = document.querySelector(`[data-request-id="${requestId}"]`);
    if (!card) return;

    let progressBar = card.querySelector('.progress-bar');
    if (!progressBar) {
      // Create progress bar if it doesn't exist
      progressBar = document.createElement('div');
      progressBar.className = 'progress-bar';
      progressBar.innerHTML = `
        <div class="progress-fill" style="width: 0%"></div>
        <span class="progress-text">0%</span>
      `;
      card.appendChild(progressBar);
    }

    const fill = progressBar.querySelector('.progress-fill');
    const text = progressBar.querySelector('.progress-text');
    const percent = Math.round(progress * 100);
    
    fill.style.width = `${percent}%`;
    text.textContent = `${percent}%`;
  }

  // Mark request as complete
  markRequestComplete(requestId) {
    const card = document.querySelector(`[data-request-id="${requestId}"]`);
    if (!card) return;

    card.classList.remove('processing', 'pending');
    card.classList.add('completed');

    // Optionally refresh the data
    if (window.refreshRequest) {
      window.refreshRequest(requestId);
    }
  }

  // Clean up connections
  disconnect() {
    this.connections.forEach(eventSource => eventSource.close());
    this.connections.clear();
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  window.taskflowRealTime = new TaskFlowRealTimeUpdates();
  window.taskflowRealTime.initDashboard();
});

// Clean up when page unloads
window.addEventListener('beforeunload', () => {
  if (window.taskflowRealTime) {
    window.taskflowRealTime.disconnect();
  }
});

// Auto-reconnect on visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && window.taskflowRealTime) {
    window.taskflowRealTime.initDashboard();
  }
});

// CSS to add to your dashboard
const styles = `
<style>
.progress-bar {
  width: 100%;
  height: 20px;
  background: #f0f0f0;
  border-radius: 10px;
  overflow: hidden;
  margin: 10px 0;
}

.progress-fill {
  height: 100%;
  background: #4CAF50;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  width: 100%;
  text-align: center;
  line-height: 20px;
  font-size: 12px;
}

.status.completed {
  color: #4CAF50;
}

.complete-icon {
  margin-left: 5px;
  font-weight: bold;
}

[data-request-id].completed {
  opacity: 0.9;
  border-color: #4CAF50;
}
</style>
`;

// Add styles to page
document.head.insertAdjacentHTML('beforeend', styles);