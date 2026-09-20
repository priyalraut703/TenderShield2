#!/usr/bin/env bash
# Compile the TenderShield Compact contract on Windows via WSL.
# The Compact toolchain has no native Windows binaries (see
# https://docs.midnight.network/guides/windows-compact-setup), so we run the
# compiler inside the WSL Ubuntu distribution from the Windows project dir.
set -euo pipefail

export PATH="$HOME/.local/bin:$HOME/.compact/bin:$PATH"

# Pin the toolchain that pairs with the SDK set below (compact-runtime 0.16.0).
# The `compact` CLI can manage several toolchains side-by-side.
if ! compact --version 2>/dev/null | grep -q "0.31.1"; then
  compact update 0.31.1
fi

# Resolve the project root relative to this script (the script lives in scripts/).
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"
echo "Compiling TenderShield from: $PROJECT_DIR"
compact --version
compact compile contracts/tendershield.compact managed/tendershield

echo "Generated artifacts in managed/tendershield:"
find managed/tendershield -maxdepth 2 -type d | sort