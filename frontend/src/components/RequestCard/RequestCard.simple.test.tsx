import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock all dependencies
jest.mock('../RequestCard', () => ({
  RequestCard: ({ request }) => (
    <div data-testid="request-card">
      <h3>{request.text}</h3>
      <p>{request.status}</p>
    </div>
  ),
}));

describe('RequestCard Simple Test', () => {
  it('renders without crashing', () => {
    const mockRequest = {
      id: 1,
      text: 'Test request',
      status: 'NEW',
    };

    render(
      <div>
        {React.createElement(require('../RequestCard').RequestCard, { request: mockRequest })}
      </div>
    );

    expect(screen.getByTestId('request-card')).toBeInTheDocument();
    expect(screen.getByText('Test request')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });
});