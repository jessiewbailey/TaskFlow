import api from './client';
import { exerciseClient } from './exerciseClient';

// Mock the api client
jest.mock('./client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('Exercise Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should fetch all exercises', async () => {
      const mockExercises = [
        { id: 1, name: 'Exercise 1', description: 'Test exercise 1' },
        { id: 2, name: 'Exercise 2', description: 'Test exercise 2' },
      ];

      (api.get as jest.Mock).mockResolvedValue({ data: mockExercises });

      const result = await exerciseClient.list();

      expect(api.get).toHaveBeenCalledWith('/api/exercises/');
      expect(result).toEqual(mockExercises);
    });

    it('should fetch active exercises only', async () => {
      const mockExercises = [
        { id: 1, name: 'Exercise 1', description: 'Test exercise 1', is_active: true },
      ];

      (api.get as jest.Mock).mockResolvedValue({ data: mockExercises });

      const result = await exerciseClient.list(true);

      expect(api.get).toHaveBeenCalledWith('/api/exercises/?is_active=true');
      expect(result).toEqual(mockExercises);
    });

    it('should handle errors when fetching exercises', async () => {
      const error = new Error('Network error');
      (api.get as jest.Mock).mockRejectedValue(error);

      await expect(exerciseClient.list()).rejects.toThrow('Network error');
    });
  });

  describe('create', () => {
    it('should create a new exercise', async () => {
      const newExercise = { name: 'New Exercise', description: 'A new test exercise' };
      const createdExercise = { id: 3, ...newExercise };

      (api.post as jest.Mock).mockResolvedValue({ data: createdExercise });

      const result = await exerciseClient.create(newExercise);

      expect(api.post).toHaveBeenCalledWith('/api/exercises/', newExercise);
      expect(result).toEqual(createdExercise);
    });

    it('should handle validation errors', async () => {
      const invalidExercise = { name: '' }; // Invalid data
      const error = { response: { data: { detail: 'Name is required' } } };
      
      (api.post as jest.Mock).mockRejectedValue(error);

      await expect(exerciseClient.create(invalidExercise as any)).rejects.toEqual(error);
    });
  });

  describe('update', () => {
    it('should update an existing exercise', async () => {
      const exerciseId = 1;
      const updates = { name: 'Updated Exercise', description: 'Updated description' };
      const updatedExercise = { id: exerciseId, ...updates };

      (api.put as jest.Mock).mockResolvedValue({ data: updatedExercise });

      const result = await exerciseClient.update(exerciseId, updates);

      expect(api.put).toHaveBeenCalledWith(`/api/exercises/${exerciseId}`, updates);
      expect(result).toEqual(updatedExercise);
    });

    it('should handle not found errors', async () => {
      const exerciseId = 999;
      const updates = { name: 'Updated Exercise' };
      const error = { response: { status: 404, data: { detail: 'Exercise not found' } } };

      (api.put as jest.Mock).mockRejectedValue(error);

      await expect(exerciseClient.update(exerciseId, updates)).rejects.toEqual(error);
    });
  });

  describe('delete', () => {
    it('should delete an exercise', async () => {
      const exerciseId = 1;
      const response = { message: 'Exercise deleted successfully' };
      
      (api.delete as jest.Mock).mockResolvedValue({ data: response });

      const result = await exerciseClient.delete(exerciseId);

      expect(api.delete).toHaveBeenCalledWith(`/api/exercises/${exerciseId}`);
      expect(result).toEqual(response);
    });

    it('should handle deletion of non-existent exercise', async () => {
      const exerciseId = 999;
      const error = { response: { status: 404 } };

      (api.delete as jest.Mock).mockRejectedValue(error);

      await expect(exerciseClient.delete(exerciseId)).rejects.toEqual(error);
    });
  });

  describe('setDefault', () => {
    it('should set an exercise as default', async () => {
      const exerciseId = 1;
      const response = { id: exerciseId, is_default: true };

      (api.post as jest.Mock).mockResolvedValue({ data: response });

      const result = await exerciseClient.setDefault(exerciseId);

      expect(api.post).toHaveBeenCalledWith(`/api/exercises/${exerciseId}/set-default`);
      expect(result).toEqual(response);
    });

    it('should handle setting default on non-existent exercise', async () => {
      const exerciseId = 999;
      const error = { response: { status: 404, data: { detail: 'Exercise not found' } } };

      (api.post as jest.Mock).mockRejectedValue(error);

      await expect(exerciseClient.setDefault(exerciseId)).rejects.toEqual(error);
    });
  });

  describe('getDefault', () => {
    it('should get the default exercise', async () => {
      const defaultExercise = { id: 1, name: 'Default Exercise', is_default: true };

      (api.get as jest.Mock).mockResolvedValue({ data: defaultExercise });

      const result = await exerciseClient.getDefault();

      expect(api.get).toHaveBeenCalledWith('/api/exercises/default');
      expect(result).toEqual(defaultExercise);
    });

    it('should return null when no default exercise', async () => {
      (api.get as jest.Mock).mockResolvedValue({ data: null });

      const result = await exerciseClient.getDefault();

      expect(result).toBeNull();
    });
  });
});