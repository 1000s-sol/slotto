#!/usr/bin/env bash
# Build + deploy slotto_lottery to Solana devnet (uses lottery test wallet, not ~/.config/solana/id.json).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

WALLET="${LOTTERY_TEST_WALLET:-.keys/lottery-integration.json}"
RPC="${LOTTERY_DEVNET_RPC:-https://api.devnet.solana.com}"
MIN_SOL="${LOTTERY_DEVNET_MIN_BALANCE:-3}"

if [[ ! -f "${WALLET}" ]]; then
  echo "lottery-deploy-devnet: missing keypair ${WALLET}" >&2
  echo "  Import with: npm run lottery:import-wallet" >&2
  exit 1
fi

PUBKEY="$(solana-keygen pubkey "${WALLET}")"
PROGRAM_ID="$(solana-keygen pubkey target/deploy/slotto_lottery-keypair.json 2>/dev/null || true)"

echo "lottery-deploy-devnet: authority ${PUBKEY}"
if [[ -n "${PROGRAM_ID}" ]]; then
  echo "lottery-deploy-devnet: program id   ${PROGRAM_ID}"
fi

echo "lottery-deploy-devnet: build…"
bash scripts/anchor-build.sh

BAL="$(solana balance "${PUBKEY}" -u "${RPC}" 2>/dev/null | awk '{print $1}')"
echo "lottery-deploy-devnet: devnet balance ${BAL} SOL (need ~${MIN_SOL} for first deploy)"

if awk "BEGIN { exit !(${BAL} < ${MIN_SOL}) }" 2>/dev/null; then
  echo "lottery-deploy-devnet: airdropping 2 SOL on devnet…"
  solana airdrop 2 "${PUBKEY}" -u "${RPC}" || true
  sleep 3
  BAL="$(solana balance "${PUBKEY}" -u "${RPC}" 2>/dev/null | awk '{print $1}')"
  echo "lottery-deploy-devnet: balance now ${BAL} SOL"
  if awk "BEGIN { exit !(${BAL} < ${MIN_SOL}) }" 2>/dev/null; then
    echo "lottery-deploy-devnet: still low — fund ${PUBKEY} on devnet and re-run" >&2
    exit 1
  fi
fi

echo "lottery-deploy-devnet: deploy…"
anchor deploy \
  --provider.cluster devnet \
  --provider.wallet "${WALLET}" \
  --program-name slotto_lottery

PROGRAM_ID="$(solana-keygen pubkey target/deploy/slotto_lottery-keypair.json)"
echo ""
echo "lottery-deploy-devnet: done."
echo "  Program id: ${PROGRAM_ID}"
echo "  Upgrade authority: ${PUBKEY}"
echo ""
echo "Add to .env:"
echo "  NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID=${PROGRAM_ID}"
echo "  NEXT_PUBLIC_SOLANA_RPC_URL=${RPC}"
