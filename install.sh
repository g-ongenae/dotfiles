#!/usr/bin/env bash
set -euo pipefail
DOTFILES_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo "$@"
  fi
}

if ! command -v python3 >/dev/null 2>&1; then
  case "$(uname -s)" in
    Darwin)
      BREW_BIN="$(command -v brew || true)"
      if [ -z "$BREW_BIN" ] && [ -x /opt/homebrew/bin/brew ]; then
        BREW_BIN=/opt/homebrew/bin/brew
      elif [ -z "$BREW_BIN" ] && [ -x /usr/local/bin/brew ]; then
        BREW_BIN=/usr/local/bin/brew
      fi
      if [ -z "$BREW_BIN" ]; then
        echo "Homebrew is required to install Python 3: https://brew.sh" >&2
        exit 1
      fi
      "$BREW_BIN" install python3
      PATH="$(dirname -- "$BREW_BIN"):$PATH"
      export PATH
      ;;
    Linux)
      if [ ! -r /etc/os-release ]; then
        echo "Cannot detect this Linux distribution to install Python 3." >&2
        exit 1
      fi
      # shellcheck disable=SC1091
      . /etc/os-release
      case "${ID:-}" in
        fedora) run_as_root dnf install -y python3 ;;
        debian)
          run_as_root apt-get update
          run_as_root apt-get install -y python3
          ;;
        *)
          echo "Unsupported Linux distribution '${ID:-unknown}'; install Python 3 and rerun." >&2
          exit 1
          ;;
      esac
      ;;
    *)
      echo "Unsupported platform; install Python 3 and rerun." >&2
      exit 1
      ;;
  esac
fi
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 installation completed but python3 is still not available in PATH." >&2
  exit 1
fi
exec python3 "$DOTFILES_ROOT/scripts/install.py" "$@"
