import { renderHook, act } from '@testing-library/react';
import { useToast } from './useToast';

// Mock setTimeout
jest.useFakeTimers();

describe('useToast', () => {
  beforeEach(() => {
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  it('should return initial state', () => {
    const { result } = renderHook(() => useToast());

    expect(result.current.toasts).toEqual([]);
    expect(result.current).toHaveProperty('showToast');
    expect(result.current).toHaveProperty('removeToast');
  });

  it('should add toast with showToast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Success message', 'success');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0]).toMatchObject({
      message: 'Success message',
      type: 'success',
      id: expect.any(String),
    });
  });

  it('should add multiple toasts', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('First toast', 'info');
      result.current.showToast('Second toast', 'error');
      result.current.showToast('Third toast', 'warning');
    });

    expect(result.current.toasts).toHaveLength(3);
    expect(result.current.toasts[0].message).toBe('First toast');
    expect(result.current.toasts[1].message).toBe('Second toast');
    expect(result.current.toasts[2].message).toBe('Third toast');
  });

  it('should use info as default type', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Default type toast');
    });

    expect(result.current.toasts[0].type).toBe('info');
  });

  it('should remove toast by id', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Toast to remove', 'success');
    });

    const toastId = result.current.toasts[0].id;

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should auto-remove toast after 5 seconds', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Auto-remove toast', 'info');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  it('should handle removing non-existent toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Existing toast', 'success');
    });

    act(() => {
      result.current.removeToast('non-existent-id');
    });

    expect(result.current.toasts).toHaveLength(1);
  });

  it('should maintain separate timeouts for multiple toasts', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('First toast', 'info');
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.showToast('Second toast', 'success');
    });

    expect(result.current.toasts).toHaveLength(2);

    // First toast should disappear after 3 more seconds
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Second toast');

    // Second toast should disappear after 2 more seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.toasts).toHaveLength(0);
  });
});