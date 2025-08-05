// Custom render function and test utilities for TaskFlow

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import userEvent from '@testing-library/user-event';

// Import your store configuration
// import { rootReducer } from '../store';

// Create a custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: any;
  store?: any;
}

function customRender(
  ui: ReactElement,
  {
    initialState,
    store = configureStore({
      reducer: {
        // Add your reducers here
        // Example: user: userReducer,
      },
      preloadedState: initialState,
    }),
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </Provider>
    );
  }

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store,
  };
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Utility functions for common test scenarios
export const waitForLoadingToFinish = () => {
  return screen.findByText(/loading/i, {}, { timeout: 3000 })
    .then(() => screen.waitForElementToBeRemoved(() => screen.queryByText(/loading/i)));
};

// Mock data generators
export const createMockRequest = (overrides = {}) => ({
  id: 1,
  text: 'Test request text',
  requester: 'test@example.com',
  status: 'NEW',
  priority: 'medium',
  created_at: new Date().toISOString(),
  workflow_id: 1,
  ...overrides,
});

export const createMockWorkflow = (overrides = {}) => ({
  id: 1,
  name: 'Test Workflow',
  description: 'A test workflow',
  status: 'ACTIVE',
  is_default: false,
  blocks: [],
  ...overrides,
});

export const createMockUser = (overrides = {}) => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  role: 'ANALYST',
  ...overrides,
});

// Helper to wait for async updates
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Screen size helpers for responsive testing
export const setMobileViewport = () => {
  window.innerWidth = 375;
  window.innerHeight = 667;
  window.dispatchEvent(new Event('resize'));
};

export const setDesktopViewport = () => {
  window.innerWidth = 1920;
  window.innerHeight = 1080;
  window.dispatchEvent(new Event('resize'));
};

// Import screen for convenience
import { screen } from '@testing-library/react';