#!/usr/bin/env bash
# Integration tests: local validator + deploy + ts-mocha (Anchor 0.30 + --skip-build often skips validator).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

RPC="http://127.0.0.1:8899"
LEDGER=".anchor/test-ledger"
WALLET="${LOTTERY_TEST_WALLET:-.keys/lottery-integration.json}"
EXPECTED_PUBKEY="${LOTTERY_TEST_PUBKEY:-Hcm8gHTnsSENygdXihgnYUhxycVNtmtTNBLwybQiJAyh}"

if [[ ! -f "${WALLET}" ]]; then
  echo "lottery-test-integration: missing keypair at ${WALLET}" >&2
  exit 1
fi

ACTUAL_PUBKEY="$(solana-keygen pubkey "${WALLET}")"
if [[ "${ACTUAL_PUBKEY}" != "${EXPECTED_PUBKEY}" ]]; then
  echo "lottery-test-integration: wallet pubkey mismatch (${ACTUAL_PUBKEY} != ${EXPECTED_PUBKEY})" >&2
  exit 1
fi
echo "lottery-test-integration: wallet ${ACTUAL_PUBKEY}"

validator_pid=""
cleanup() {
  if [[ -n "${validator_pid}" ]]; then
    kill "${validator_pid}" 2>/dev/null || true
    wait "${validator_pid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

port_in_use() {
  local port="$1"
  command -v lsof >/dev/null 2>&1 && lsof -ti ":${port}" >/dev/null 2>&1
}

kill_pids_on_ports() {
  local port
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  for port in "$@"; do
    local pids
    pids="$(lsof -ti ":${port}" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "lottery-test-integration: freeing port ${port}…"
      # shellcheck disable=SC2086
      kill ${pids} 2>/dev/null || true
    fi
  done
}

stop_local_validator() {
  echo "lottery-test-integration: stopping any solana-test-validator…"
  pkill -f solana-test-validator 2>/dev/null || true
  sleep 2
  kill_pids_on_ports 8899 8900 9900 19900
  sleep 1
  if port_in_use 8899 || port_in_use 9900; then
    echo "lottery-test-integration: force-stopping leftover processes on 8899/9900/19900…"
    kill_pids_on_ports 8899 8900 9900 19900
    for port in 8899 8900 9900 19900; do
      local pids
      pids="$(lsof -ti ":${port}" 2>/dev/null || true)"
      if [[ -n "${pids}" ]]; then
        # shellcheck disable=SC2086
        kill -9 ${pids} 2>/dev/null || true
      fi
    done
    sleep 1
  fi
}

pick_faucet_port() {
  for port in 9900 19900 29900; do
    if ! port_in_use "${port}"; then
      echo "${port}"
      return 0
    fi
  done
  echo "19900"
}

start_local_validator() {
  local faucet_port="$1"
  echo "lottery-test-integration: starting solana-test-validator (RPC 8899, faucet ${faucet_port})…"
  rm -rf "${LEDGER}"
  mkdir -p "${LEDGER}"
  solana-test-validator \
    --ledger "${LEDGER}" \
    --reset \
    --rpc-port 8899 \
    --faucet-port "${faucet_port}" \
    >"${LEDGER}/validator.log" 2>&1 &
  validator_pid=$!
}

validator_failed_to_start() {
  if [[ -n "${validator_pid}" ]] && ! kill -0 "${validator_pid}" 2>/dev/null; then
    return 0
  fi
  if [[ -f "${LEDGER}/validator.log" ]] &&
    grep -qE "Unable to bind faucet|Address already in use" "${LEDGER}/validator.log" 2>/dev/null; then
    return 0
  fi
  return 1
}

wait_for_validator() {
  for _ in $(seq 1 120); do
    if solana cluster-version -u "${RPC}" >/dev/null 2>&1; then
      return 0
    fi
    if validator_failed_to_start; then
      return 1
    fi
    sleep 1
  done
  return 1
}

REUSE_VALIDATOR=0
if [[ "${LOTTERY_TEST_REUSE_VALIDATOR:-}" == "1" ]] && solana cluster-version -u "${RPC}" >/dev/null 2>&1; then
  REUSE_VALIDATOR=1
  echo "lottery-test-integration: reusing validator on ${RPC}"
else
  stop_local_validator
  validator_ready=0
  for _ in 1 2 3; do
    FAUCET_PORT="$(pick_faucet_port)"
    start_local_validator "${FAUCET_PORT}"
    if wait_for_validator; then
      validator_ready=1
      break
    fi
    echo "lottery-test-integration: validator failed on faucet ${FAUCET_PORT} (see ${LEDGER}/validator.log)" >&2
    tail -5 "${LEDGER}/validator.log" 2>/dev/null || true
    if [[ -n "${validator_pid}" ]]; then
      kill "${validator_pid}" 2>/dev/null || true
      wait "${validator_pid}" 2>/dev/null || true
      validator_pid=""
    fi
    stop_local_validator
  done
  if [[ "${validator_ready}" -ne 1 ]]; then
    echo "lottery-test-integration: could not start validator" >&2
    exit 1
  fi
fi

echo "lottery-test-integration: building program…"
bash scripts/anchor-build.sh

if [[ "${REUSE_VALIDATOR}" -ne 1 ]] && ! solana cluster-version -u "${RPC}" >/dev/null 2>&1; then
  echo "lottery-test-integration: validator not reachable after build" >&2
  exit 1
fi

PUBKEY="$(solana-keygen pubkey "${WALLET}")"
echo "lottery-test-integration: funding ${PUBKEY}…"
for _ in 1 2 3 4; do
  solana airdrop 10 "${PUBKEY}" -u "${RPC}" >/dev/null 2>&1 || true
  sleep 1
done
solana balance "${PUBKEY}" -u "${RPC}"

echo "lottery-test-integration: deploy program to localnet…"
anchor deploy --provider.cluster localnet --provider.wallet "${WALLET}" --program-name slotto_lottery

export ANCHOR_PROVIDER_URL="${RPC}"
export ANCHOR_WALLET="${WALLET}"

# Anchor workspace loader expects target/idl/<program>.json during ts-mocha tests.
mkdir -p target/idl
cp idl/slotto_lottery.json target/idl/slotto_lottery.json

echo "lottery-test-integration: running tests/slotto_lottery.ts…"
exec npx ts-mocha -p ./tsconfig.anchor.json -t 1000000 tests/**/*.ts
