import axios from 'axios';
import { apiClient, setAuthToken, clearAuthToken, handleApiError } from './client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  describe('apiClient configuration', () => {
    it('should create axios instance with correct base URL', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: expect.stringContaining('/api'),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('setAuthToken', () => {
    it('should set authorization header and store token', () => {
      const token = 'test-jwt-token';
      setAuthToken(token);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('authToken', token);
    });

    it('should handle null token', () => {
      setAuthToken(null);
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });

    it('should handle undefined token', () => {
      setAuthToken(undefined);
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  describe('clearAuthToken', () => {
    it('should remove token from localStorage', () => {
      clearAuthToken();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('authToken');
    });
  });

  describe('handleApiError', () => {
    it('should return error message from response data', () => {
      const error = {
        response: {
          data: {
            message: 'Custom error message',
          },
        },
      };

      const result = handleApiError(error);
      expect(result).toBe('Custom error message');
    });

    it('should return detail from response data if no message', () => {
      const error = {
        response: {
          data: {
            detail: 'Detailed error message',
          },
        },
      };

      const result = handleApiError(error);
      expect(result).toBe('Detailed error message');
    });

    it('should return status text if no message or detail', () => {
      const error = {
        response: {
          statusText: 'Bad Request',
          data: {},
        },
      };

      const result = handleApiError(error);
      expect(result).toBe('Bad Request');
    });

    it('should return error message for non-response errors', () => {
      const error = {
        message: 'Network Error',
      };

      const result = handleApiError(error);
      expect(result).toBe('Network Error');
    });

    it('should return default message for unknown errors', () => {
      const result = handleApiError({});
      expect(result).toBe('An unexpected error occurred');
    });

    it('should return default message for null error', () => {
      const result = handleApiError(null);
      expect(result).toBe('An unexpected error occurred');
    });

    it('should handle 401 errors specially', () => {
      const error = {
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
        },
      };

      const result = handleApiError(error);
      expect(result).toBe('Unauthorized');
      // In a real app, this might trigger a logout or redirect
    });
  });

  describe('Auth token initialization', () => {
    it('should load token from localStorage on initialization', () => {
      // This would typically happen when the module is imported
      expect(localStorageMock.getItem).toHaveBeenCalledWith('authToken');
    });
  });
});