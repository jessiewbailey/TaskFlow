import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/test-helpers';
import { Settings } from './Settings';
import { useLocation } from 'react-router-dom';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useLocation: jest.fn(),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}));

describe('Settings Layout', () => {
  beforeEach(() => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/settings/exercises',
    });
  });

  it('renders settings layout with navigation', () => {
    renderWithProviders(
      <Settings>
        <div>Settings Content</div>
      </Settings>
    );
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Settings Content')).toBeInTheDocument();
  });

  it('shows all navigation items', () => {
    renderWithProviders(
      <Settings>
        <div>Content</div>
      </Settings>
    );
    
    expect(screen.getByText('Exercises')).toBeInTheDocument();
    expect(screen.getByText('Workflows')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('Fine-Tuning')).toBeInTheDocument();
    expect(screen.getByText('Similarity Search')).toBeInTheDocument();
    expect(screen.getByText('User Interface')).toBeInTheDocument();
  });

  it('highlights active navigation item', () => {
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/settings/workflows',
    });

    renderWithProviders(
      <Settings>
        <div>Content</div>
      </Settings>
    );
    
    const workflowsLink = screen.getByRole('link', { name: /workflows/i });
    expect(workflowsLink).toHaveClass('bg-teal-50', 'border-teal-500', 'text-teal-700');
  });

  it('renders navigation links with correct hrefs', () => {
    renderWithProviders(
      <Settings>
        <div>Content</div>
      </Settings>
    );
    
    const exercisesLink = screen.getByRole('link', { name: /exercises/i });
    expect(exercisesLink).toHaveAttribute('href', '/settings/exercises');
    
    const workflowsLink = screen.getByRole('link', { name: /workflows/i });
    expect(workflowsLink).toHaveAttribute('href', '/settings/workflows');
    
    const usersLink = screen.getByRole('link', { name: /users/i });
    expect(usersLink).toHaveAttribute('href', '/settings/users');
  });

  it('renders back to dashboard link', () => {
    renderWithProviders(
      <Settings>
        <div>Content</div>
      </Settings>
    );
    
    const backLink = screen.getByRole('link', { name: /back to dashboard/i });
    expect(backLink).toHaveAttribute('href', '/');
  });

  it('applies correct layout structure', () => {
    const { container } = renderWithProviders(
      <Settings>
        <div>Content</div>
      </Settings>
    );
    
    // Check for main container
    expect(container.querySelector('.min-h-screen')).toBeInTheDocument();
    expect(container.querySelector('.max-w-7xl')).toBeInTheDocument();
    
    // Check for grid layout
    expect(container.querySelector('.lg\\:grid-cols-12')).toBeInTheDocument();
  });

  it('highlights different active items based on location', () => {
    // Test with UI settings active
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/settings/ui',
    });

    const { rerender } = renderWithProviders(
      <Settings>
        <div>Content</div>
      </Settings>
    );
    
    let uiLink = screen.getByRole('link', { name: /user interface/i });
    expect(uiLink).toHaveClass('bg-teal-50', 'border-teal-500', 'text-teal-700');
    
    // Change location to exercises
    (useLocation as jest.Mock).mockReturnValue({
      pathname: '/settings/exercises',
    });
    
    rerender(
      <Settings>
        <div>Content</div>
      </Settings>
    );
    
    const exercisesLink = screen.getByRole('link', { name: /exercises/i });
    expect(exercisesLink).toHaveClass('bg-teal-50', 'border-teal-500', 'text-teal-700');
    
    // UI link should no longer be active
    uiLink = screen.getByRole('link', { name: /user interface/i });
    expect(uiLink).not.toHaveClass('bg-teal-50');
  });
});