import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, mockExercise } from '../test-utils/test-helpers';
import { ExerciseDropdown } from './ExerciseDropdown';

describe('ExerciseDropdown', () => {
  const mockExercises = [
    mockExercise({ id: 1, name: 'Exercise 1', description: 'First exercise', is_active: true }),
    mockExercise({ id: 2, name: 'Exercise 2', description: 'Second exercise', is_active: true }),
    mockExercise({ id: 3, name: 'Inactive Exercise', is_active: false }),
  ];

  const defaultProps = {
    exercises: mockExercises,
    selectedExercise: null,
    onSelectExercise: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with placeholder when no exercise is selected', () => {
    renderWithProviders(<ExerciseDropdown {...defaultProps} />);
    
    expect(screen.getByText('Select an exercise')).toBeInTheDocument();
  });

  it('renders with selected exercise name', () => {
    renderWithProviders(
      <ExerciseDropdown {...defaultProps} selectedExercise={mockExercises[0]} />
    );
    
    expect(screen.getByText('Exercise 1')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { container } = renderWithProviders(<ExerciseDropdown {...defaultProps} loading={true} />);
    
    const loadingElement = container.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
    expect(screen.queryByText('Select an exercise')).not.toBeInTheDocument();
  });

  it('shows empty state when no active exercises', () => {
    renderWithProviders(
      <ExerciseDropdown {...defaultProps} exercises={[mockExercises[2]]} />
    );
    
    expect(screen.getByText('No active exercises available')).toBeInTheDocument();
  });

  it('only shows active exercises in dropdown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseDropdown {...defaultProps} />);
    
    // Open dropdown
    await user.click(screen.getByRole('button'));
    
    // Active exercises should be visible
    expect(screen.getByText('Exercise 1')).toBeInTheDocument();
    expect(screen.getByText('Exercise 2')).toBeInTheDocument();
    
    // Inactive exercise should not be visible
    expect(screen.queryByText('Inactive Exercise')).not.toBeInTheDocument();
  });

  it('calls onSelectExercise when an option is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseDropdown {...defaultProps} />);
    
    // Open dropdown
    await user.click(screen.getByRole('button'));
    
    // Click on Exercise 2
    await user.click(screen.getByText('Exercise 2'));
    
    expect(defaultProps.onSelectExercise).toHaveBeenCalledWith(mockExercises[1]);
  });

  it('shows exercise descriptions in dropdown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseDropdown {...defaultProps} />);
    
    // Open dropdown
    await user.click(screen.getByRole('button'));
    
    // Descriptions should be visible
    expect(screen.getByText('First exercise')).toBeInTheDocument();
    expect(screen.getByText('Second exercise')).toBeInTheDocument();
  });

  it('highlights selected exercise with check icon', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ExerciseDropdown {...defaultProps} selectedExercise={mockExercises[0]} />
    );
    
    // Open dropdown
    await user.click(screen.getByRole('button'));
    
    // The selected option should have a check icon (we'll check for the parent element)
    const selectedOption = screen.getByRole('option', { name: /Exercise 1/ });
    expect(selectedOption).toHaveClass('font-medium');
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(
      <ExerciseDropdown {...defaultProps} className="custom-class" />
    );
    
    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('closes dropdown after selection', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseDropdown {...defaultProps} />);
    
    // Open dropdown
    await user.click(screen.getByRole('button'));
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    
    // Select an option
    await user.click(screen.getByText('Exercise 1'));
    
    // Dropdown should be closed
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keyboard navigation works', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ExerciseDropdown {...defaultProps} />);
    
    // Focus on button
    const button = screen.getByRole('button');
    button.focus();
    
    // Open with Enter key
    await user.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    
    // Navigate with arrow keys
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    
    // Select with Enter
    await user.keyboard('{Enter}');
    
    expect(defaultProps.onSelectExercise).toHaveBeenCalledWith(mockExercises[1]);
  });

  it('renders correctly with no description', async () => {
    const exercisesWithoutDesc = [
      mockExercise({ id: 1, name: 'No Desc Exercise', description: undefined, is_active: true }),
    ];
    
    const user = userEvent.setup();
    renderWithProviders(
      <ExerciseDropdown {...defaultProps} exercises={exercisesWithoutDesc} />
    );
    
    // Open dropdown
    await user.click(screen.getByRole('button'));
    
    // Should show name but no description
    expect(screen.getByText('No Desc Exercise')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });
});