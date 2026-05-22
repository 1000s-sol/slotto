#!/usr/bin/env bash
# Build SBF program + copy checked-in IDL + TS types (no `anchor idl build` / anchor-syn on host).
set -euo pipefail
cd "$(dirname "$0")/.."

# npm scripts often run without a login shell; anchor/solana live under ~/.cargo and ~/.avm.
export PATH="${HOME}/.avm/bin:${HOME}/.cargo/bin:${HOME}/.local/share/solana/install/active_release/bin:${PATH:-}"
if ! command -v anchor >/dev/null 2>&1; then
  echo "anchor-build: anchor not found on PATH." >&2
  echo "  Install: https://www.anchor-lang.com/docs/installation (this repo uses 0.30.1)" >&2
  echo "  Then: export PATH=\"\$HOME/.avm/bin:\$HOME/.cargo/bin:\$PATH\"" >&2
  exit 1
fi

rm -rf target/idl target/types
mkdir -p target/idl target/types

echo "anchor-build: sync program id (declare_id!, Anchor.toml)…"
anchor keys sync

echo "anchor-build: SBF (cargo-build-sbf → target/deploy)…"
cargo-build-sbf --manifest-path programs/slotto_lottery/Cargo.toml --sbf-out-dir target/deploy "$@"

if [[ ! -f target/deploy/slotto_lottery.so ]]; then
  echo "anchor-build: missing target/deploy/slotto_lottery.so" >&2
  exit 1
fi

echo "anchor-build: idl/slotto_lottery.json (scripts/generate-idl.mjs)…"
node scripts/generate-idl.mjs

cp idl/slotto_lottery.json target/idl/slotto_lottery.json

echo "anchor-build: TypeScript types (anchor idl type)…"
anchor idl type idl/slotto_lottery.json -o target/types/slotto_lottery.ts
cp target/types/slotto_lottery.ts src/lib/lottery/slotto_lottery.ts

if ! grep -q '"address"' target/idl/slotto_lottery.json; then
  echo "anchor-build: invalid IDL" >&2
  exit 1
fi

echo "anchor-build: done."
