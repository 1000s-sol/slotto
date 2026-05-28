#!/usr/bin/env bash
# Build + deploy slotto_lottery to Solana mainnet-beta.
# Fund the deploy wallet with ~4–5 SOL before running (see docs/mainnet-rollout.md).
set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="${HOME}/.avm/bin:${HOME}/.cargo/bin:${HOME}/.local/share/solana/install/active_release/bin:${PATH:-}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

WALLET="${LOTTERY_DEPLOY_WALLET:-${LOTTERY_TEST_WALLET:-.keys/lottery-integration.json}}"
RPC="${LOTTERY_RPC_URL:-${NEXT_PUBLIC_SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}}"
MIN_SOL="${LOTTERY_MAINNET_MIN_BALANCE:-4}"

if [[ -f "${WALLET}" ]]; then
  :
elif [[ -n "${LOTTERY_DEPLOY_WALLET:-}" ]]; then
  echo "lottery-deploy-mainnet: missing keypair ${WALLET}" >&2
  exit 1
else
  echo "lottery-deploy-mainnet: set LOTTERY_DEPLOY_WALLET or LOTTERY_TEST_WALLET" >&2
  exit 1
fi

PUBKEY="$(solana-keygen pubkey "${WALLET}")"
PROGRAM_SO="target/deploy/slotto_lottery.so"
PROGRAM_ID="$(solana-keygen pubkey target/deploy/slotto_lottery-keypair.json 2>/dev/null || true)"

echo "lottery-deploy-mainnet: cluster   mainnet-beta"
echo "lottery-deploy-mainnet: RPC       ${RPC}"
echo "lottery-deploy-mainnet: authority ${PUBKEY}"
if [[ -n "${PROGRAM_ID}" ]]; then
  echo "lottery-deploy-mainnet: program id ${PROGRAM_ID}"
fi

echo ""
echo ">>> MAINNET deploy — real SOL. Confirm recipients in src/lib/lottery/recipients.ts"
echo ">>> Do NOT run public lottery until Switchboard VRF is wired (see docs/mainnet-rollout.md)."
echo ""
read -r -p "Type 'deploy' to continue: " CONFIRM
if [[ "${CONFIRM}" != "deploy" ]]; then
  echo "Aborted."
  exit 1
fi

echo "lottery-deploy-mainnet: build…"
bash scripts/anchor-build.sh

if [[ ! -f "${PROGRAM_SO}" ]]; then
  echo "lottery-deploy-mainnet: missing ${PROGRAM_SO}" >&2
  exit 1
fi

BYTES="$(wc -c < "${PROGRAM_SO}" | tr -d ' ')"
RENT_EST="$(solana rent "${BYTES}" -u mainnet-beta 2>/dev/null | awk '{print $1}' || echo "?")"
BAL="$(solana balance "${PUBKEY}" -u "${RPC}" 2>/dev/null | awk '{print $1}')"
echo "lottery-deploy-mainnet: program size ${BYTES} bytes, rent-exempt ~${RENT_EST} SOL"
echo "lottery-deploy-mainnet: wallet balance ${BAL} SOL (recommend >= ${MIN_SOL})"

if awk "BEGIN { exit !(${BAL} < ${MIN_SOL}) }" 2>/dev/null; then
  echo "lottery-deploy-mainnet: balance too low — fund ${PUBKEY} on mainnet and re-run" >&2
  exit 1
fi

echo "lottery-deploy-mainnet: deploy…"
anchor deploy \
  --provider.cluster mainnet \
  --provider.wallet "${WALLET}" \
  --program-name slotto_lottery

PROGRAM_ID="$(solana-keygen pubkey target/deploy/slotto_lottery-keypair.json)"
echo ""
echo "lottery-deploy-mainnet: done."
echo "  Program id: ${PROGRAM_ID}"
echo "  Upgrade authority: ${PUBKEY}"
echo ""
echo "Next:"
echo "  1. anchor keys sync && commit declare_id / IDL if changed"
echo "  2. Vercel: NEXT_PUBLIC_SLOTTO_LOTTERY_PROGRAM_ID=${PROGRAM_ID}"
echo "  3. Vercel: NEXT_PUBLIC_SOLANA_RPC_URL=<mainnet Helius URL>"
echo "  4. npm run lottery:init   (with mainnet RPC + deploy wallet in .env)"
