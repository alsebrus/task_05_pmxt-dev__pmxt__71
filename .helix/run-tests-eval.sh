#!/bin/bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE_NAME="pmxt-metaculus-eval"

echo "=== Building Docker image ==="
docker build -f "$REPO_ROOT/.helix/Dockerfile.helix" -t "$IMAGE_NAME" "$REPO_ROOT"

echo "=== Running test suite ==="
docker run --rm "$IMAGE_NAME" npm test

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "=== ALL TESTS PASSED ==="
else
    echo "=== TESTS FAILED (exit code: $EXIT_CODE) ==="
fi

exit $EXIT_CODE
