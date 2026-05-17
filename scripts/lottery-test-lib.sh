#!/usr/bin/env bash
# Fast program unit tests.
#
# By default keeps Cargo incremental cache (reruns in seconds).
# If you hit: dep-graph.part.bin: No such file or directory (os error 2)
#   LOTTERY_TEST_CLEAN=1 npm run lottery:test
#   npm run lottery:test -- --clean
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

clean=0
if [[ "${LOTTERY_TEST_CLEAN:-}" == "1" ]]; then
  clean=1
fi
args=()
for a in "$@"; do
  if [[ "$a" == "--clean" ]]; then
    clean=1
  else
    args+=("$a")
  fi
done

if [[ "$clean" == "1" ]]; then
  rm -rf target/debug/incremental/slotto_lottery-* 2>/dev/null || true
  echo "lottery-test-lib: cleared slotto_lottery incremental cache"
fi

if ((${#args[@]} > 0)); then
  exec cargo test -p slotto-lottery --lib --locked "${args[@]}"
else
  exec cargo test -p slotto-lottery --lib --locked
fi
