import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestCard } from '../RequestCard';

// Mock the hooks
jest.mock('../../hooks/useRequestProgress', () => ({
  useRequestProgress: () => ({
    isProcessing: false,
    queuePosition: null,
    status: 'idle',
    progress: 0,
  }),
}));

// Mock request data
const mockRequest = {
  id: 1,
  text: 'Please analyze this document for key insights',
  requester: 'test@example.com',
  status: 'NEW',
  priority: 'high',
  workflow_id: 1,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

const mockProcessingRequest = {
  ...mockRequest,
  id: 2,
  status: 'PENDING',
  processing_status: 'RUNNING',
  queue_position: 3,
};

const mockCompletedRequest = {
  ...mockRequest,
  id: 3,
  status: 'CLOSED',
  processing_status: 'COMPLETED',
  ai_outputs: [
    {
      id: 1,
      summary: '{"Analysis": {"result": "Key insights found"}}',
      created_at: '2024-01-15T10:30:00Z',
    },
  ],
};

describe('RequestCard', () => {
  it('renders request information correctly', () => {
    render(<RequestCard request={mockRequest} />);
    
    // Check if basic information is displayed
    expect(screen.getByText(mockRequest.text)).toBeInTheDocument();
    expect(screen.getByText(/Priority:/)).toBeInTheDocument();
    expect(screen.getByText(mockRequest.priority)).toBeInTheDocument();
    expect(screen.getByText(mockRequest.requester)).toBeInTheDocument();
  });

  it('displays correct status badge for new requests', () => {
    render(<RequestCard request={mockRequest} />);
    
    const statusBadge = screen.getByText('NEW');
    expect(statusBadge).toBeInTheDocument();
    expect(statusBadge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('shows processing status with queue position', () => {
    render(<RequestCard request={mockProcessingRequest} />);
    
    expect(screen.getByText('3 jobs ahead')).toBeInTheDocument();
    expect(screen.getByText('3 jobs ahead')).toHaveClass('text-amber-600');
  });

  it('shows starting status when queue position is 0', () => {
    const startingRequest = {
      ...mockProcessingRequest,
      queue_position: 0,
    };
    
    render(<RequestCard request={startingRequest} />);
    
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  it('displays completion status correctly', () => {
    render(<RequestCard request={mockCompletedRequest} />);
    
    expect(screen.getByText('CLOSED')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toHaveClass('text-green-600');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<RequestCard request={mockRequest} onClick={handleClick} />);
    
    const card = screen.getByRole('article');
    fireEvent.click(card);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(mockRequest.id);
  });

  it('applies hover styles when clickable', () => {
    const handleClick = jest.fn();
    render(<RequestCard request={mockRequest} onClick={handleClick} />);
    
    const card = screen.getByRole('article');
    expect(card).toHaveClass('cursor-pointer', 'hover:shadow-lg');
  });

  it('does not apply hover styles when not clickable', () => {
    render(<RequestCard request={mockRequest} />);
    
    const card = screen.getByRole('article');
    expect(card).not.toHaveClass('cursor-pointer');
  });

  it('formats dates correctly', () => {
    render(<RequestCard request={mockRequest} />);
    
    // Check if date is formatted (exact format depends on implementation)
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
  });

  it('displays priority with correct styling', () => {
    const { rerender } = render(<RequestCard request={mockRequest} />);
    
    // High priority
    expect(screen.getByText('high')).toHaveClass('text-red-600');
    
    // Medium priority
    const mediumRequest = { ...mockRequest, priority: 'medium' };
    rerender(<RequestCard request={mediumRequest} />);
    expect(screen.getByText('medium')).toHaveClass('text-yellow-600');
    
    // Low priority
    const lowRequest = { ...mockRequest, priority: 'low' };
    rerender(<RequestCard request={lowRequest} />);
    expect(screen.getByText('low')).toHaveClass('text-green-600');
  });

  it('shows progress bar for processing requests', () => {
    render(<RequestCard request={mockProcessingRequest} />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('truncates long text with ellipsis', () => {
    const longTextRequest = {
      ...mockRequest,
      text: 'This is a very long request text that should be truncated when displayed in the card component to maintain a clean and consistent layout across all request cards in the application interface',
    };
    
    render(<RequestCard request={longTextRequest} />);
    
    const textElement = screen.getByText(/This is a very long request text/);
    expect(textElement).toHaveClass('line-clamp-2');
  });
});