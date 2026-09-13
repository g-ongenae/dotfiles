#!/usr/bin/env bash
# Compatibility entry point: prepare CLI dependencies, not a GUI AppImage.
# T3 hosting, authentication and Tailscale enrollment are separate operations.
set -euo pipefail
DOTFILES_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
exec bash "$DOTFILES_ROOT/install.sh" --profile debian-server "$@"
