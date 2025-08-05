import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockRequest } from '../test-utils/test-helpers';
import { RequestDrawer } from './RequestDrawer';
import { useUpdateRequest, useDeleteRequest } from '../hooks/useRequests';
import { useUISettings } from '../hooks/useUISettings';
import { format } from 'date-fns';

// Mock hooks
jest.mock('../hooks/useRequests');
jest.mock('../hooks/useUISettings');

// Mock API client
jest.mock('../api/client', () => ({
  taskflowApi: {
    processRequest: jest.fn(),
  },
}));

// Mock components that are used within RequestDrawer
jest.mock('./CustomInstructions', () => ({
  CustomInstructions: ({ request }: any) => (
    <div data-testid="custom-instructions">Custom Instructions for {request?.id}</div>
  ),
}));

jest.mock('./DashboardRenderer', () => ({
  DashboardRenderer: ({ data }: any) => (
    <div data-testid="dashboard-renderer">Dashboard</div>
  ),
}));

const mockUpdateMutateAsync = jest.fn();
const mockDeleteMutateAsync = jest.fn();

describe('RequestDrawer', () => {
  const defaultProps = {
    request: mockRequest({ id: 1, text: 'Test request text' }),
    isOpen: true,
    onClose: jest.fn(),
    onRequestUpdated: jest.fn(),
    onRequestDeleted: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useUpdateRequest as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    });

    (useDeleteRequest as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    });

    (useUISettings as jest.Mock).mockReturnValue({
      showSimilarityFeatures: true,
    });

    // Mock fetch for similar tasks
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ similar_tasks: [] }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders request details when open', () => {
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    expect(screen.getByText('Request Details')).toBeInTheDocument();
    expect(screen.getByText('Test request text')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithProviders(<RequestDrawer {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Request Details')).not.toBeInTheDocument();
  });

  it('does not render when request is null', () => {
    renderWithProviders(<RequestDrawer {...defaultProps} request={null} />);
    
    expect(screen.queryByText('Request Details')).not.toBeInTheDocument();
  });

  it('shows tabs for different views', () => {
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ai output/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /workflow/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /similar/i })).toBeInTheDocument();
  });

  it('handles edit mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    // Click edit button
    const editButton = screen.getByRole('button', { name: /edit/i });
    await user.click(editButton);
    
    // Should show edit fields
    expect(screen.getByLabelText(/request text/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/requester/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
    
    // Should show save and cancel buttons
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('validates request text when saving edit', async () => {
    const user = userEvent.setup();
    window.alert = jest.fn();
    
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    // Enter edit mode
    await user.click(screen.getByRole('button', { name: /edit/i }));
    
    // Clear request text
    const textInput = screen.getByLabelText(/request text/i);
    await user.clear(textInput);
    await user.type(textInput, 'Short');
    
    // Try to save
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    
    expect(window.alert).toHaveBeenCalledWith('Request text must be at least 10 characters long');
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('updates request successfully', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    // Enter edit mode
    await user.click(screen.getByRole('button', { name: /edit/i }));
    
    // Update text
    const textInput = screen.getByLabelText(/request text/i);
    await user.clear(textInput);
    await user.type(textInput, 'Updated request text with enough characters');
    
    // Save changes
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    
    // Confirm update
    await user.click(screen.getByRole('button', { name: /confirm/i }));
    
    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: 1,
        payload: {
          text: 'Updated request text with enough characters',
          requester: 'test@example.com',
          status: 'NEW',
        },
      });
    });
    
    expect(defaultProps.onRequestUpdated).toHaveBeenCalled();
  });

  it('cancels edit mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    // Enter edit mode
    await user.click(screen.getByRole('button', { name: /edit/i }));
    
    // Cancel
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    
    // Should exit edit mode
    expect(screen.queryByLabelText(/request text/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('handles delete confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    // Click delete button
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);
    
    // Should show confirmation dialog
    expect(screen.getByText(/are you sure you want to delete this request/i)).toBeInTheDocument();
    
    // Confirm deletion
    await user.click(screen.getByRole('button', { name: /delete request/i }));
    
    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith(1);
    });
    
    expect(defaultProps.onRequestDeleted).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('shows similar tasks when similarity features are enabled', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        similar_tasks: [
          { id: 2, text: 'Similar task 1', similarity_score: 0.95 },
          { id: 3, text: 'Similar task 2', similarity_score: 0.85 },
        ],
      }),
    });
    
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    // Click similar tab
    const similarTab = screen.getByRole('tab', { name: /similar/i });
    await userEvent.click(similarTab);
    
    await waitFor(() => {
      expect(screen.getByText('Similar Tasks')).toBeInTheDocument();
    });
  });

  it('hides similar tab when similarity features are disabled', () => {
    (useUISettings as jest.Mock).mockReturnValue({
      showSimilarityFeatures: false,
    });
    
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    expect(screen.queryByRole('tab', { name: /similar/i })).not.toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    const request = mockRequest({
      created_at: '2024-01-15T10:30:00Z',
      updated_at: '2024-01-15T14:45:00Z',
    });
    
    renderWithProviders(<RequestDrawer {...defaultProps} request={request} />);
    
    // Check if dates are formatted
    expect(screen.getByText(format(new Date(request.created_at), 'MMM d, yyyy h:mm a'))).toBeInTheDocument();
  });

  it('shows status badge with correct color', () => {
    const request = mockRequest({ status: 'IN_PROGRESS' });
    
    renderWithProviders(<RequestDrawer {...defaultProps} request={request} />);
    
    const statusBadge = screen.getByText('IN_PROGRESS');
    expect(statusBadge).toHaveClass('bg-blue-100', 'text-blue-800');
  });

  it('closes drawer when close button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RequestDrawer {...defaultProps} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});