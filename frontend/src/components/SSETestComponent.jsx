import React, { useState, useEffect } from 'react';
import { useRequestProgress } from '../hooks/useRequestProgress';

const SSETestComponent = ({ requestId }) => {
  const progress = useRequestProgress(requestId);
  const [events, setEvents] = useState([]);

  // Log all progress changes
  useEffect(() => {
    if (progress.message) {
      const newEvent = {
        time: new Date().toLocaleTimeString(),
        status: progress.status,
        percentage: progress.percentage,
        message: progress.message,
        jobType: progress.jobType,
        embeddingStatus: progress.embeddingStatus
      };
      setEvents(prev => [...prev, newEvent]);
      console.log('Progress update:', newEvent);
    }
  }, [progress.message, progress.status, progress.percentage]);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>SSE Test for Request #{requestId}</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <p><strong>Connection:</strong> {progress.isConnected ? '✅ Connected' : '❌ Disconnected'}</p>
        <p><strong>Status:</strong> {progress.status}</p>
        <p><strong>Progress:</strong> {progress.percentage.toFixed(1)}%</p>
        <p><strong>Message:</strong> {progress.message || 'No message'}</p>
        {progress.jobType && <p><strong>Job Type:</strong> {progress.jobType}</p>}
        {progress.embeddingStatus && <p><strong>Embedding Status:</strong> {progress.embeddingStatus}</p>}
        {progress.elapsedTime && <p><strong>Elapsed Time:</strong> {progress.elapsedTime}</p>}
        {progress.estimatedRemainingTime && <p><strong>Est. Remaining:</strong> {progress.estimatedRemainingTime}</p>}
        {progress.error && <p style={{color: 'red'}}><strong>Error:</strong> {progress.error}</p>}
      </div>

      {progress.isProcessing && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            width: '100%', 
            height: '20px', 
            backgroundColor: '#e0e0e0', 
            borderRadius: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progress.percentage}%`,
              height: '100%',
              backgroundColor: '#4CAF50',
              transition: 'width 0.5s ease-in-out'
            }} />
          </div>
        </div>
      )}

      {progress.totalSteps > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <p><strong>Steps:</strong> {progress.stepNumber} / {progress.totalSteps}</p>
          {progress.currentStep && <p><strong>Current Step:</strong> {progress.currentStep}</p>}
          
          {progress.completedSteps.length > 0 && (
            <div>
              <strong>Completed Steps:</strong>
              <ul>
                {progress.completedSteps.map((step, index) => (
                  <li key={index}>
                    {step.name} - {new Date(step.completedAt).toLocaleTimeString()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div>
        <h4>Event Log:</h4>
        <div style={{ 
          maxHeight: '200px', 
          overflow: 'auto', 
          border: '1px solid #ddd', 
          padding: '10px',
          fontSize: '12px'
        }}>
          {events.length === 0 ? (
            <p>No events received yet...</p>
          ) : (
            events.map((event, index) => (
              <div key={index} style={{ marginBottom: '5px' }}>
                <strong>{event.time}:</strong> [{event.status}] {event.message} ({event.percentage.toFixed(1)}%)
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SSETestComponent;