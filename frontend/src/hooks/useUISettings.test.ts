import { renderHook, waitFor } from '@testing-library/react';
import { useUISettings } from './useUISettings';

// Mock fetch
global.fetch = jest.fn();

describe('useUISettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fetch UI settings successfully', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: "true" }),
      });

    const { result } = renderHook(() => useUISettings());

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for settings to load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.showLogsButton).toBe(true);
    expect(result.current.showSimilarityFeatures).toBe(true);

    // Check fetch calls
    expect(global.fetch).toHaveBeenCalledWith('/api/settings/system/ui_show_logs_button');
    expect(global.fetch).toHaveBeenCalledWith('/api/settings/system/ui_show_similarity_features');
  });

  it('should handle false settings values', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: false }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: "false" }),
      });

    const { result } = renderHook(() => useUISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.showLogsButton).toBe(false);
    expect(result.current.showSimilarityFeatures).toBe(false);
  });

  it('should handle fetch errors with defaults', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    const { result } = renderHook(() => useUISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should default to true on error
    expect(result.current.showLogsButton).toBe(true);
    expect(result.current.showSimilarityFeatures).toBe(true);
    expect(consoleSpy).toHaveBeenCalledWith('Error loading UI settings:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should handle non-ok responses with defaults', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

    const { result } = renderHook(() => useUISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should default to true when settings not found
    expect(result.current.showLogsButton).toBe(true);
    expect(result.current.showSimilarityFeatures).toBe(true);
  });

  it('should handle mixed responses', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: false }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

    const { result } = renderHook(() => useUISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.showLogsButton).toBe(false);
    expect(result.current.showSimilarityFeatures).toBe(true); // Defaults to true on error
  });

  it('should handle various value formats', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: 'invalid' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: null }),
      });

    const { result } = renderHook(() => useUISettings());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Invalid values should be treated as false
    expect(result.current.showLogsButton).toBe(false);
    expect(result.current.showSimilarityFeatures).toBe(false);
  });
});