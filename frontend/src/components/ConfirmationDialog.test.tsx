import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmationDialog } from './ConfirmationDialog';

describe('ConfirmationDialog Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(<ConfirmationDialog {...defaultProps} />);
    
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<ConfirmationDialog {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);
    
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ConfirmationDialog {...defaultProps} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders custom confirm button text', () => {
    render(
      <ConfirmationDialog 
        {...defaultProps} 
        confirmText="Delete" 
      />
    );
    
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('renders custom cancel button text', () => {
    render(
      <ConfirmationDialog 
        {...defaultProps} 
        cancelText="Go Back" 
      />
    );
    
    expect(screen.getByRole('button', { name: 'Go Back' })).toBeInTheDocument();
  });

  it('shows danger styling when type is danger', () => {
    render(
      <ConfirmationDialog 
        {...defaultProps} 
        type="danger" 
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toHaveClass('bg-red-600');
  });

  it('shows warning styling when type is warning', () => {
    render(
      <ConfirmationDialog 
        {...defaultProps} 
        type="warning" 
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toHaveClass('bg-yellow-600');
  });

  it('shows info styling when type is info', () => {
    render(
      <ConfirmationDialog 
        {...defaultProps} 
        type="info" 
      />
    );
    
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    expect(confirmButton).toHaveClass('bg-blue-600');
  });

});