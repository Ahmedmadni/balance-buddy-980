#!/usr/bin/env bash
# Install the exact locked dependency graph. If an old Sharp dependency must
# compile because its upstream prebuilt binary is temporarily unavailable,
# provide libvips headers on GitHub's Ubuntu runner and retry without
# bypassing install scripts or changing the lockfile.
set -euo pipefail

if bun install --frozen-lockfile; then
  exit 0
fi

if [[ "${RUNNER_OS:-}" != "Linux" ]]; then
  echo "::error::Locked dependency install failed (native fallback is Linux-only)"
  exit 1
fi

echo "::warning::Locked install failed; retrying with Ubuntu libvips development headers"
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends libvips-dev pkg-config
# Remove incomplete Sharp build and regenerate node_modules from bun.lock.
rm -rf node_modules
bun install --frozen-lockfile
