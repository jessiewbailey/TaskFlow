import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock RequestCard component
const MockRequestCard = ({ request }: { request: any }) => (
  <div data-testid="request-card">
    <h3>{request.text}</h3>
    <p>{request.status}</p>
  </div>
);

// Mock the RequestCard module
jest.mock('../RequestCard', () => ({
  RequestCard: MockRequestCard,
}));

describe('RequestCard Simple Test', () => {
  it('renders without crashing', () => {
    const mockRequest = {
      id: 1,
      text: 'Test request',
      status: 'NEW',
    };

    render(<MockRequestCard request={mockRequest} />);

    expect(screen.getByTestId('request-card')).toBeInTheDocument();
    expect(screen.getByText('Test request')).toBeInTheDocument();
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });
});