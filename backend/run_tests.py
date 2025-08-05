#!/usr/bin/env python
"""
Simple test runner to work around import issues
"""
import sys
import os

# Add tests directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'tests'))

# Import test initialization first
import test_init

# Now run pytest
import pytest

if __name__ == "__main__":
    # Run unit tests only for now
    sys.exit(pytest.main([
        "tests/unit/services/test_job_service.py::TestJobQueueManager::test_init",
        "-xvs",
        "--tb=short"
    ]))