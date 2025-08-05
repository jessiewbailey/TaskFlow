import axios from 'axios';
import { taskflowApi } from './client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TaskFlow API Client', () => {
  let mockApiInstance: any;

  beforeEach(() => {
    // Create a mock instance with all the methods we need
    mockApiInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn().mockReturnValue(mockApiInstance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRequests', () => {
    it('should fetch requests without filters', async () => {
      const mockResponse = {
        data: {
          tasks: [
            { id: 1, text: 'Task 1', status: 'NEW' },
            { id: 2, text: 'Task 2', status: 'PENDING' },
          ],
          total: 2,
        },
      };

      mockApiInstance.get.mockResolvedValue(mockResponse);

      const result = await taskflowApi.getRequests();

      expect(mockApiInstance.get).toHaveBeenCalledWith('/api/requests?');
      expect(result).toEqual(mockResponse.data);
    });

    it('should fetch requests with filters', async () => {
      const filters = {
        analyst: 1,
        status: 'PENDING',
        exercise_id: 2,
        sort_by: 'created_at',
        order: 'desc' as const,
        page: 1,
        page_size: 20,
      };

      const mockResponse = { data: { tasks: [], total: 0 } };
      mockApiInstance.get.mockResolvedValue(mockResponse);

      await taskflowApi.getRequests(filters);

      const expectedUrl = '/api/requests?analyst=1&status=PENDING&exercise_id=2&sort_by=created_at&order=desc&page=1&page_size=20';
      expect(mockApiInstance.get).toHaveBeenCalledWith(expectedUrl);
    });
  });

  describe('getRequest', () => {
    it('should fetch a single request by id', async () => {
      const requestId = 123;
      const mockRequest = {
        id: requestId,
        text: 'Test request',
        status: 'NEW',
      };

      mockApiInstance.get.mockResolvedValue({ data: mockRequest });

      const result = await taskflowApi.getRequest(requestId);

      expect(mockApiInstance.get).toHaveBeenCalledWith(`/api/requests/${requestId}`);
      expect(result).toEqual(mockRequest);
    });
  });

  describe('createRequest', () => {
    it('should create a new request', async () => {
      const payload = {
        text: 'New request',
        priority: 'high',
        requester: 'test@example.com',
      };

      const mockResponse = {
        data: {
          id: 1,
          ...payload,
          status: 'NEW',
        },
      };

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await taskflowApi.createRequest(payload);

      expect(mockApiInstance.post).toHaveBeenCalledWith('/api/requests', payload);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('deleteRequest', () => {
    it('should delete a request', async () => {
      const requestId = 123;
      mockApiInstance.delete.mockResolvedValue({ data: { success: true } });

      await taskflowApi.deleteRequest(requestId);

      expect(mockApiInstance.delete).toHaveBeenCalledWith(`/api/requests/${requestId}`);
    });
  });

  describe('processRequest', () => {
    it('should process a request', async () => {
      const requestId = 123;
      const payload = {
        workflow_id: 1,
        use_ai: true,
      };

      const mockResponse = {
        data: {
          job_id: 'job-123',
          status: 'PENDING',
        },
      };

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await taskflowApi.processRequest(requestId, payload);

      expect(mockApiInstance.post).toHaveBeenCalledWith(
        `/api/requests/${requestId}/process`,
        payload
      );
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getModels', () => {
    it('should fetch available models', async () => {
      const mockModels = {
        models: [
          { name: 'model1', modified_at: '2024-01-01', size: 1000 },
          { name: 'model2', modified_at: '2024-01-02', size: 2000 },
        ],
      };

      mockApiInstance.get.mockResolvedValue({ data: mockModels });

      const result = await taskflowApi.getModels();

      expect(mockApiInstance.get).toHaveBeenCalledWith('/api/models');
      expect(result).toEqual(mockModels);
    });
  });

  describe('retryRequest', () => {
    it('should retry a failed request', async () => {
      const requestId = 123;
      const mockResponse = { data: { success: true } };

      mockApiInstance.post.mockResolvedValue(mockResponse);

      const result = await taskflowApi.retryRequest(requestId);

      expect(mockApiInstance.post).toHaveBeenCalledWith(`/api/requests/${requestId}/retry`);
      expect(result).toEqual(mockResponse.data);
    });
  });
});