#!/bin/bash
# Setup pre-commit hooks for TaskFlow

set -e

echo "Setting up pre-commit hooks for TaskFlow..."

# Check if pre-commit is installed
if ! command -v pre-commit &> /dev/null; then
    echo "Installing pre-commit..."
    pip install pre-commit
fi

# Install the pre-commit hooks
echo "Installing pre-commit hooks..."
pre-commit install
pre-commit install --hook-type commit-msg

# Run pre-commit on all files to check current state
echo "Running pre-commit on all files (this may take a while)..."
pre-commit run --all-files || true

echo "Pre-commit hooks installed successfully!"
echo ""
echo "Pre-commit will now run automatically on:"
echo "  - Every git commit (on staged files)"
echo "  - Commit message validation"
echo ""
echo "To run manually on all files: pre-commit run --all-files"
echo "To run on specific files: pre-commit run --files <file1> <file2>"
echo "To skip hooks temporarily: git commit --no-verify"