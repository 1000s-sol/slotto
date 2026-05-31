#!/usr/bin/env bash
# One-time: store CRON_SECRET in GitHub Actions (same value as Vercel).
set -euo pipefail
cd "$(dirname "$0")/.."

REPO="${GITHUB_REPO:-1000s-sol/slotto}"

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required."
  echo "  brew install gh"
  echo "  gh auth login"
  exit 1
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

SECRET="${CRON_SECRET:-${LOTTERY_CRON_SECRET:-}}"
if [[ -z "${SECRET}" ]]; then
  echo "CRON_SECRET not found. Add it to .env or run:" >&2
  echo "  CRON_SECRET='...' $0" >&2
  exit 1
fi

echo "Setting GitHub Actions secret CRON_SECRET on ${REPO} ..."
gh secret set CRON_SECRET --body "${SECRET}" --repo "${REPO}"

echo "Triggering a test run (workflow_dispatch) ..."
gh workflow run lottery-crank.yml --repo "${REPO}"

echo ""
echo "Open Actions to confirm:"
echo "  https://github.com/${REPO}/actions/workflows/lottery-crank.yml"
echo ""
echo "Scheduled runs: every 5 minutes on the default branch."
