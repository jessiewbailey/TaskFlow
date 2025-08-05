import React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

// Create a custom render function that includes providers
export function renderWithProviders(
  ui: React.ReactElement,
  {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    }),
    ...renderOptions
  } = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

// Re-export everything
export * from '@testing-library/react';

// Mock data generators
export const mockRequest = (overrides = {}) => ({
  id: 1,
  text: 'Test request',
  requester: 'test@example.com',
  status: 'NEW',
  priority: 'medium',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const mockWorkflow = (overrides = {}) => ({
  id: 1,
  name: 'Test Workflow',
  description: 'A test workflow',
  status: 'ACTIVE',
  blocks: [],
  ...overrides,
});

export const mockExercise = (overrides = {}) => ({
  id: 1,
  name: 'Test Exercise',
  description: 'A test exercise',
  is_active: true,
  is_default: false,
  ...overrides,
});

export const mockUser = (overrides = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'ANALYST',
  ...overrides,
});