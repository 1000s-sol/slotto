#!/usr/bin/env bash
# Build SBF program + copy checked-in IDL + TS types (no `anchor idl build` / anchor-syn on host).
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf target/idl target/types
mkdir -p target/idl target/types

echo "anchor-build: SBF (anchor build --no-idl)…"
anchor build --no-idl "$@"

if [[ ! -f target/deploy/slotto_lottery.so ]]; then
  echo "anchor-build: missing target/deploy/slotto_lottery.so" >&2
  exit 1
fi

echo "anchor-build: sync program id (declare_id!, Anchor.toml)…"
anchor keys sync

echo "anchor-build: idl/slotto_lottery.json (scripts/generate-idl.mjs)…"
node scripts/generate-idl.mjs

cp idl/slotto_lottery.json target/idl/slotto_lottery.json

echo "anchor-build: TypeScript types (anchor idl type)…"
anchor idl type idl/slotto_lottery.json -o target/types/slotto_lottery.ts

if ! grep -q '"address"' target/idl/slotto_lottery.json; then
  echo "anchor-build: invalid IDL" >&2
  exit 1
fi

echo "anchor-build: done."
