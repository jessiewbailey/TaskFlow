import React, { useState } from 'react';
import { ProgressBar } from './ProgressBar';

export const ProgressBarTest = () => {
  const [testCases] = useState([
    {
      title: 'Pending State',
      props: {
        percentage: 0,
        status: 'PENDING',
        message: 'Waiting to start...',
        variant: 'default'
      }
    },
    {
      title: 'Running - Embedding',
      props: {
        percentage: 35,
        status: 'RUNNING',
        message: 'Generating embeddings for task description...',
        variant: 'embedding',
        elapsedTime: '0:15',
        estimatedRemainingTime: '0:28'
      }
    },
    {
      title: 'Running - Workflow',
      props: {
        percentage: 60,
        status: 'RUNNING',
        message: 'Processing workflow step...',
        currentStep: 'Data Analysis',
        stepNumber: 3,
        totalSteps: 5,
        variant: 'workflow',
        elapsedTime: '2:45',
        estimatedRemainingTime: '1:50'
      }
    },
    {
      title: 'Completed',
      props: {
        percentage: 100,
        status: 'COMPLETED',
        message: 'Task processing completed successfully',
        variant: 'default',
        elapsedTime: '1:23'
      }
    },
    {
      title: 'Failed',
      props: {
        percentage: 75,
        status: 'FAILED',
        message: 'Error: Connection timeout while processing',
        variant: 'default',
        elapsedTime: '0:45'
      }
    },
    {
      title: 'Minimal View',
      props: {
        percentage: 50,
        status: 'RUNNING',
        showDetails: false
      }
    }
  ]);

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>ProgressBar Component Test</h2>
      
      {testCases.map((testCase, index) => (
        <div key={index} style={{ marginBottom: '40px' }}>
          <h3>{testCase.title}</h3>
          <ProgressBar {...testCase.props} />
        </div>
      ))}

      <div style={{ marginTop: '40px' }}>
        <h3>Live Progress Simulation</h3>
        <LiveProgressDemo />
      </div>
    </div>
  );
};

// Live demo component
const LiveProgressDemo = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('PENDING');
  const [isRunning, setIsRunning] = useState(false);

  const startSimulation = () => {
    setProgress(0);
    setStatus('RUNNING');
    setIsRunning(true);

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 15;
        if (newProgress >= 100) {
          clearInterval(interval);
          setStatus('COMPLETED');
          setIsRunning(false);
          return 100;
        }
        return newProgress;
      });
    }, 500);
  };

  const reset = () => {
    setProgress(0);
    setStatus('PENDING');
    setIsRunning(false);
  };

  const simulateFail = () => {
    setStatus('FAILED');
    setIsRunning(false);
  };

  return (
    <div>
      <ProgressBar
        percentage={progress}
        status={status}
        message={
          status === 'RUNNING' ? `Processing... ${Math.floor(progress)}% complete` :
          status === 'COMPLETED' ? 'Processing completed successfully!' :
          status === 'FAILED' ? 'Processing failed - Click reset to try again' :
          'Click start to begin processing'
        }
        variant="workflow"
        elapsedTime={isRunning || status === 'COMPLETED' || status === 'FAILED' ? '0:12' : null}
        estimatedRemainingTime={isRunning && progress > 10 ? '0:45' : null}
      />
      
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={startSimulation} 
          disabled={isRunning}
          style={{
            padding: '8px 16px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.5 : 1
          }}
        >
          Start Simulation
        </button>
        
        <button 
          onClick={simulateFail} 
          disabled={!isRunning}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: !isRunning ? 'not-allowed' : 'pointer',
            opacity: !isRunning ? 0.5 : 1
          }}
        >
          Simulate Failure
        </button>
        
        <button 
          onClick={reset}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default ProgressBarTest;