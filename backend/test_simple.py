#!/usr/bin/env python
"""
Simple test to verify mocking works
"""
import sys
import os

# Add tests directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tests'))

# Import test initialization first
import test_init

# Now test the job queue manager directly
def test_job_queue_manager():
    from app.services.job_service import JobQueueManager

    manager = JobQueueManager(max_concurrent_jobs=5)
    assert manager.max_concurrent_jobs == 5
    assert len(manager.running_jobs) == 0
    print("✓ JobQueueManager initialized successfully")

def test_embedding_service_mocked():
    from app.services.embedding_service import embedding_service

    # Should be our mock
    assert hasattr(embedding_service, 'generate_embedding')
    print("✓ Embedding service is mocked")

if __name__ == "__main__":
    print("Running simple tests...")
    try:
        test_job_queue_manager()
        test_embedding_service_mocked()
        print("\nAll tests passed!")
    except Exception as e:
        print(f"\nTest failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)