import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test-utils/test-helpers';
import { NewRequestModal } from './NewRequestModal';
import { useCreateRequest } from '../hooks/useRequests';
import { useWorkflows } from '../hooks/useWorkflows';
import { useUILabels } from '../hooks/useConfig';

// Mock hooks
jest.mock('../hooks/useRequests');
jest.mock('../hooks/useWorkflows');
jest.mock('../hooks/useConfig');

const mockCreateRequest = jest.fn();
const mockMutateAsync = jest.fn();

describe('NewRequestModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useCreateRequest as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
    });

    (useWorkflows as jest.Mock).mockReturnValue({
      data: {
        workflows: [
          { id: 1, name: 'Workflow 1' },
          { id: 2, name: 'Workflow 2' },
        ],
      },
    });

    (useUILabels as jest.Mock).mockReturnValue({
      data: {
        forms: {
          new_task_modal: {
            requester_label: 'Submitter',
            requester_placeholder: 'Enter requester name or organization',
          },
        },
      },
    });
  });

  it('renders when open', () => {
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByLabelText(/submitter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/workflow/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/task description/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderWithProviders(<NewRequestModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Create New Task')).not.toBeInTheDocument();
  });

  it('shows workflows in dropdown', () => {
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    const workflowSelect = screen.getByLabelText(/workflow/i);
    expect(workflowSelect).toBeInTheDocument();
    expect(screen.getByText('Use default workflow')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Workflow 1' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Workflow 2' })).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    // Fill form
    await user.type(screen.getByLabelText(/submitter/i), 'John Doe');
    await user.selectOptions(screen.getByLabelText(/workflow/i), '1');
    await user.type(screen.getByLabelText(/task description/i), 'This is a test task with enough characters');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /create task/i }));
    
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        text: 'This is a test task with enough characters',
        requester: 'John Doe',
        workflow_id: 1,
        exercise_id: undefined,
      });
    });
  });

  it('includes exercise_id when selectedExercise is provided', async () => {
    const user = userEvent.setup();
    const selectedExercise = { id: 5, name: 'Test Exercise' };
    
    renderWithProviders(
      <NewRequestModal {...defaultProps} selectedExercise={selectedExercise} />
    );
    
    await user.type(screen.getByLabelText(/task description/i), 'This is a test task with enough characters');
    await user.click(screen.getByRole('button', { name: /create task/i }));
    
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        text: 'This is a test task with enough characters',
        requester: undefined,
        workflow_id: null,
        exercise_id: 5,
      });
    });
  });

  it('disables submit button when text is too short', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    const submitButton = screen.getByRole('button', { name: /create task/i });
    const textArea = screen.getByLabelText(/task description/i);
    
    // Initially disabled (empty text)
    expect(submitButton).toBeDisabled();
    
    // Still disabled with short text
    await user.type(textArea, 'Short');
    expect(submitButton).toBeDisabled();
    
    // Enabled with long enough text
    await user.type(textArea, ' enough text now');
    expect(submitButton).not.toBeDisabled();
  });

  it('shows loading state when submitting', () => {
    (useCreateRequest as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
    });
    
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /creating/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/submitter/i)).toBeDisabled();
    expect(screen.getByLabelText(/workflow/i)).toBeDisabled();
    expect(screen.getByLabelText(/task description/i)).toBeDisabled();
  });

  it('shows error message on submission failure', () => {
    (useCreateRequest as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: true,
    });
    
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    expect(screen.getByText(/failed to create request/i)).toBeInTheDocument();
  });

  it('closes modal and resets form on successful submission', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce({ id: 1 });
    
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    // Fill and submit form
    await user.type(screen.getByLabelText(/task description/i), 'This is a test task with enough characters');
    await user.click(screen.getByRole('button', { name: /create task/i }));
    
    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles cancel button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('handles close button click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    // Find the close button by its aria-label
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('prevents closing while submitting', async () => {
    (useCreateRequest as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: true,
      isError: false,
    });
    
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    // Try to close via cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toBeDisabled();
  });

  it('trims whitespace from inputs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    // Fill form with whitespace
    await user.type(screen.getByLabelText(/submitter/i), '  John Doe  ');
    await user.type(screen.getByLabelText(/task description/i), '  This is a test task with enough characters  ');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /create task/i }));
    
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        text: 'This is a test task with enough characters',
        requester: 'John Doe',
        workflow_id: null,
        exercise_id: undefined,
      });
    });
  });

  it('handles empty requester field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewRequestModal {...defaultProps} />);
    
    // Only fill task description
    await user.type(screen.getByLabelText(/task description/i), 'This is a test task with enough characters');
    
    // Submit
    await user.click(screen.getByRole('button', { name: /create task/i }));
    
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        text: 'This is a test task with enough characters',
        requester: undefined,
        workflow_id: null,
        exercise_id: undefined,
      });
    });
  });
});