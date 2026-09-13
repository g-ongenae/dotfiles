#!/usr/bin/env bash
set -euo pipefail
DOTFILES_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it with Homebrew, dnf, or apt, then rerun." >&2
  exit 1
fi
exec python3 "$DOTFILES_ROOT/scripts/install.py" "$@"
