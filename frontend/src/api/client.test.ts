// Mock axios before importing anything else
const mockAxiosInstance = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() }
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  patch: jest.fn(),
};

jest.mock('axios', () => ({
  create: jest.fn(() => mockAxiosInstance),
  default: {
    create: jest.fn(() => mockAxiosInstance),
  },
}));

import axios from 'axios';
import api, { taskflowApi, API_BASE_URL } from './client';

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
    localStorageMock.getItem.mockReturnValue(null);
  });

  describe('API configuration', () => {
    it('should have correct API base URL', () => {
      expect(API_BASE_URL).toBe('http://localhost:8000');
    });
  });

  describe('taskflowApi', () => {
    it('should have all expected methods', () => {
      expect(taskflowApi).toHaveProperty('getRequests');
      expect(taskflowApi).toHaveProperty('getRequest');
      expect(taskflowApi).toHaveProperty('createRequest');
      expect(taskflowApi).toHaveProperty('updateRequestStatus');
      expect(taskflowApi).toHaveProperty('updateRequest');
      expect(taskflowApi).toHaveProperty('deleteRequest');
      expect(taskflowApi).toHaveProperty('processRequest');
      expect(taskflowApi).toHaveProperty('getJobStatus');
      expect(taskflowApi).toHaveProperty('streamJobProgress');
      expect(taskflowApi).toHaveProperty('getOllamaModels');
    });

    it('should call correct API endpoint for getRequests', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { items: [], total: 0 } });

      await taskflowApi.getRequests();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/requests?');
    });

    it('should call correct API endpoint for getRequest', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 1, text: 'Test' } });

      await taskflowApi.getRequest(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/requests/1');
    });

    it('should call correct API endpoint for createRequest', async () => {
      const payload = { text: 'Test request' };
      mockAxiosInstance.post.mockResolvedValue({ data: { id: 1 } });

      await taskflowApi.createRequest(payload);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/requests', payload);
    });

    it('should handle filters in getRequests', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { items: [], total: 0 } });

      await taskflowApi.getRequests({ 
        analyst: 1, 
        status: 'NEW', 
        page: 2,
        page_size: 10 
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        '/api/requests?analyst=1&status=NEW&page=2&page_size=10'
      );
    });

    it('should handle getOllamaModels success', async () => {
      const mockModels = { models: [{ name: 'llama2' }] };
      mockAxiosInstance.get.mockResolvedValue({ data: mockModels });

      const result = await taskflowApi.getOllamaModels();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/models/ollama');
      expect(result).toEqual({
        models: mockModels.models,
        total: 1
      });
    });

    it('should handle getOllamaModels error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await taskflowApi.getOllamaModels();

      expect(result).toEqual({
        models: [],
        total: 0,
        error: 'Failed to connect to Ollama'
      });
    });
  });

  describe('axios instance', () => {
    it('should export the axios instance', () => {
      expect(api).toBeDefined();
      expect(api).toHaveProperty('get');
      expect(api).toHaveProperty('post');
      expect(api).toHaveProperty('put');
      expect(api).toHaveProperty('delete');
    });
  });
});