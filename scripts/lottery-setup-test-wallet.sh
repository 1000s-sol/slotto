#!/usr/bin/env bash
# Copy or recover a keypair for integration tests (pubkey Hcm8... by default).
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${LOTTERY_TEST_WALLET:-.keys/lottery-integration.json}"
EXPECTED="${LOTTERY_TEST_PUBKEY:-Hcm8gHTnsSENygdXihgnYUhxycVNtmtTNBLwybQiJAyh}"

usage() {
  cat <<EOF
Usage:
  bash scripts/lottery-setup-test-wallet.sh /path/to/existing-keypair.json
  bash scripts/lottery-setup-test-wallet.sh --recover
  npm run lottery:import-wallet   # Phantom/Solflare base58 export (hidden prompt)

Copies the keypair to: ${TARGET}
Checks pubkey matches: ${EXPECTED}

After setup, run: npm run lottery:test:integration

Environment (optional, written to .env on copy):
  LOTTERY_TEST_WALLET=${TARGET}
  LOTTERY_TEST_PUBKEY=${EXPECTED}
EOF
}

ensure_env_line() {
  local key="$1"
  local val="$2"
  touch .env
  if grep -q "^${key}=" .env 2>/dev/null; then
    if [[ "$(uname)" == Darwin ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" .env
    else
      sed -i "s|^${key}=.*|${key}=${val}|" .env
    fi
  else
    printf '\n# Lottery integration tests (local validator only)\n' >> .env
    echo "${key}=${val}" >> .env
  fi
}

verify_target() {
  mkdir -p "$(dirname "${TARGET}")"
  chmod 600 "${TARGET}"
  actual="$(solana-keygen pubkey "${TARGET}")"
  if [[ "${actual}" != "${EXPECTED}" ]]; then
    echo "error: keypair pubkey is ${actual}, expected ${EXPECTED}" >&2
    echo "  Set LOTTERY_TEST_PUBKEY=${actual} in .env if this wallet is intentional." >&2
    exit 1
  fi
  echo "ok: ${TARGET} -> ${actual}"
  ensure_env_line "LOTTERY_TEST_WALLET" "${TARGET}"
  ensure_env_line "LOTTERY_TEST_PUBKEY" "${EXPECTED}"
  echo "Updated .env (LOTTERY_TEST_WALLET, LOTTERY_TEST_PUBKEY)"
}

case "${1:-}" in
  -h | --help | "")
    usage
    exit 0
    ;;
  --recover)
    mkdir -p "$(dirname "${TARGET}")"
    if [[ -f "${TARGET}" ]]; then
      echo "error: ${TARGET} already exists; remove it first or pick another LOTTERY_TEST_WALLET" >&2
      exit 1
    fi
    echo "Enter seed phrase when prompted (creates ${TARGET})..."
    solana-keygen recover -o "${TARGET}" 'prompt://?key=0/0'
    verify_target
    ;;
  *)
    src="$1"
    if [[ ! -f "${src}" ]]; then
      echo "error: not a file: ${src}" >&2
      exit 1
    fi
    src_pub="$(solana-keygen pubkey "${src}")"
    if [[ "${src_pub}" != "${EXPECTED}" ]]; then
      echo "error: ${src} is ${src_pub}, expected ${EXPECTED}" >&2
      exit 1
    fi
    mkdir -p "$(dirname "${TARGET}")"
    src_abs="$(cd "$(dirname "${src}")" && pwd)/$(basename "${src}")"
    target_abs="$(cd "$(dirname "${TARGET}")" 2>/dev/null && pwd)/$(basename "${TARGET}")" || target_abs="${PWD}/${TARGET}"
    if [[ "${src_abs}" != "${target_abs}" ]]; then
      cp "${src}" "${TARGET}"
    fi
    verify_target
    ;;
esac
