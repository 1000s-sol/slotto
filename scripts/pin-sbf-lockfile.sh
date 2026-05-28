#!/usr/bin/env bash
# Pin Cargo.lock for Solana cargo-build-sbf (Cargo 1.84, no edition2024).
# Run from repo root after `cargo generate-lockfile` if resolution pulls incompatible crates.
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="${HOME}/.cache/solana/v1.48/platform-tools/rust/bin:${PATH:-}"
CARGO="${CARGO:-$(command -v cargo)}"
if [[ -z "$CARGO" ]]; then
  echo "pin-sbf-lockfile: cargo not found (install Solana platform-tools or set CARGO)" >&2
  exit 1
fi

echo "pin-sbf-lockfile: using $($CARGO --version)"

$CARGO update -p blake3 --precise 1.5.5
$CARGO update -p indexmap --precise 2.6.0
$CARGO update -p cc@1.2.62 --precise 1.1.37 2>/dev/null || $CARGO update -p cc --precise 1.1.37
$CARGO update -p jobserver@0.1.34 --precise 0.1.32 2>/dev/null || true

echo "pin-sbf-lockfile: done (verify with: npm run lottery:build)"
