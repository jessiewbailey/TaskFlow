// MSW server configuration for tests

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// This configures a request mocking server with the given request handlers.
export const server = setupServer(...handlers);

// Expose methods to manipulate the server instance
export { rest } from 'msw';
export { handlers, errorHandlers } from './handlers';