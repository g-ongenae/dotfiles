#!/usr/bin/env bash
# Uses the same manifests as a fresh install; defaults to a dry run.
set -euo pipefail
DOTFILES_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
profile_args=()
if [ -n "${DOTFILES_PROFILE:-}" ]; then
  profile_args=(--profile "$DOTFILES_PROFILE")
fi
exec bash "$DOTFILES_ROOT/install.sh" "${profile_args[@]}" --only packages "$@"
