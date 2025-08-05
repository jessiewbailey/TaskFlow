import React from 'react';
import { render, screen } from '@testing-library/react';
import { ExerciseSettings } from './ExerciseSettings';

// Mock the ExerciseManager component
jest.mock('../components/ExerciseManager', () => ({
  ExerciseManager: () => <div data-testid="exercise-manager">Exercise Manager Component</div>
}));

describe('ExerciseSettings Page', () => {
  it('renders without crashing', () => {
    render(<ExerciseSettings />);
    expect(screen.getByText('Exercise Management')).toBeInTheDocument();
  });

  it('renders the page title and description', () => {
    render(<ExerciseSettings />);
    expect(screen.getByText('Exercise Management')).toBeInTheDocument();
    expect(screen.getByText(/Manage exercises to organize tasks/i)).toBeInTheDocument();
  });

  it('renders the ExerciseManager component', () => {
    render(<ExerciseSettings />);
    const exerciseManager = screen.getByTestId('exercise-manager');
    expect(exerciseManager).toHaveTextContent('Exercise Manager Component');
  });

  it('has correct structure', () => {
    const { container } = render(<ExerciseSettings />);
    expect(container.querySelector('h2')).toHaveTextContent('Exercise Management');
    expect(container.querySelector('p')).toHaveTextContent(/Manage exercises to organize tasks/);
    expect(screen.getByTestId('exercise-manager')).toBeInTheDocument();
  });
});