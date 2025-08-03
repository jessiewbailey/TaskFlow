import React, { useState } from 'react';
import { RequestCard } from './RequestCard';

const mockRequests = [
  {
    id: 1,
    requester: 'John Doe',
    status: 'NEW',
    embedding_status: 'PENDING',
    created_at: new Date().toISOString(),
    tasks: [
      { description: 'Analyze customer feedback data', completed: false },
      { description: 'Generate summary report', completed: false },
      { description: 'Create visualization dashboard', completed: false }
    ]
  },
  {
    id: 2,
    requester: 'Jane Smith',
    status: 'IN_REVIEW',
    analyst: 'Mike Johnson',
    embedding_status: 'PROCESSING',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    tasks: [
      { description: 'Review code implementation', completed: true },
      { description: 'Run test suite', completed: true },
      { description: 'Deploy to staging', completed: false }
    ]
  },
  {
    id: 3,
    requester: 'Bob Wilson',
    status: 'CLOSED',
    analyst: 'Sarah Davis',
    embedding_status: 'COMPLETED',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    tasks: [
      { description: 'Fix bug in payment system', completed: true },
      { description: 'Add unit tests', completed: true }
    ]
  },
  {
    id: 4,
    requester: 'Alice Brown',
    status: 'PENDING',
    embedding_status: 'FAILED',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    tasks: [
      { description: 'Investigate performance issue', completed: false }
    ]
  }
];

export const RequestCardTest = () => {
  const [selectedId, setSelectedId] = useState(null);
  const [showProgress, setShowProgress] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h2>RequestCard Component Test</h2>
      
      <div style={{ marginBottom: '20px', display: 'flex', gap: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={showProgress}
            onChange={(e) => setShowProgress(e.target.checked)}
          />
          Show Progress
        </label>
        
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={compactMode}
            onChange={(e) => setCompactMode(e.target.checked)}
          />
          Compact Mode
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: compactMode ? 'repeat(2, 1fr)' : '1fr', gap: '20px' }}>
        <div>
          <h3>Request Cards</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mockRequests.map(request => (
              <RequestCard
                key={request.id}
                request={request}
                isSelected={selectedId === request.id}
                onClick={() => setSelectedId(request.id)}
                showProgress={showProgress}
                compact={compactMode}
              />
            ))}
          </div>
        </div>

        {selectedId && !compactMode && (
          <div>
            <h3>Selected Request Details</h3>
            <div style={{ 
              padding: '20px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <pre>{JSON.stringify(mockRequests.find(r => r.id === selectedId), null, 2)}</pre>
            </div>
            
            <div style={{ marginTop: '20px' }}>
              <h4>Real-time Updates</h4>
              <p style={{ color: '#6b7280', fontSize: '14px' }}>
                If this request has active jobs, you would see real-time progress updates here.
                The progress bar would update automatically as the job processes.
              </p>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '40px' }}>
        <h3>Component Features</h3>
        <ul style={{ lineHeight: '1.8' }}>
          <li>✅ Shows request ID, requester, status, and analyst</li>
          <li>✅ Displays embedding status with visual indicators</li>
          <li>✅ Shows task completion progress</li>
          <li>✅ Integrates with real-time SSE updates via useRequestProgress hook</li>
          <li>✅ Shows live indicator when processing</li>
          <li>✅ Supports compact mode for list views</li>
          <li>✅ Responsive design with hover and selection states</li>
        </ul>
      </div>
    </div>
  );
};

export default RequestCardTest;