import React from 'react';
import { render, screen } from '@testing-library/react';

describe('Basic Test', () => {
  it('can render a simple component', () => {
    render(<div data-testid="test">Hello World</div>);
    expect(screen.getByTestId('test')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('basic math works', () => {
    expect(2 + 2).toBe(4);
  });
});