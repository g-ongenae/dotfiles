# shellcheck shell=sh
# Shared environment for Bash and Zsh, including noninteractive SSH commands.
# Keep this POSIX-compatible, silent, and free of subprocesses or prompt hooks.

# Nothing below works without the checkout location. The installer exports it
# from the managed block that sources this file.
[ -n "${DOTFILES_DIR:-}" ] || return 0

. "$DOTFILES_DIR/shell/common/t3.sh"

# Put $1 first in PATH, moving it up when it is already present further down.
dotfiles_prepend_path() {
  # Silently skip directories this machine does not have.
  [ -d "$1" ] || return 0

  # Move an existing entry too: an inherited Volta PATH must not outrank fnm.
  dotfiles_path_rest=${PATH:-}
  dotfiles_path_new=$1

  # Walk the current PATH entry by entry, copying everything except $1 itself.
  while [ -n "$dotfiles_path_rest" ]; do
    dotfiles_path_part=${dotfiles_path_rest%%:*}

    if [ -n "$dotfiles_path_part" ] && [ "$dotfiles_path_part" != "$1" ]; then
      dotfiles_path_new="$dotfiles_path_new:$dotfiles_path_part"
    fi

    case $dotfiles_path_rest in
      # Drop the entry just handled and carry on with the remainder.
      *:*) dotfiles_path_rest=${dotfiles_path_rest#*:} ;;
      # No separator left, so that was the last entry.
      *) break ;;
    esac
  done

  PATH=$dotfiles_path_new

  # A POSIX shell has no local variables; do not leak these into the session.
  unset dotfiles_path_rest dotfiles_path_new dotfiles_path_part
}

# --- Environment -------------------------------------------------------------

export ADBLOCK=1 HOMEBREW_NO_ANALYTICS=1
export EDITOR=vim VISUAL=vim
export FNM_DIR="$HOME/.local/share/fnm"

# --- PATH, least specific first so that later entries win --------------------

dotfiles_prepend_path "$HOME/go/bin"

# Per-profile paths: Homebrew on macOS, Flatpak exports on Fedora.
case "${DOTFILES_PROFILE:-}" in
  macos) . "$DOTFILES_DIR/shell/macos/env.sh" ;;
  fedora | debian-server) . "$DOTFILES_DIR/shell/linux/env.sh" ;;
esac

# fnm outranks whatever the profile added, and ~/.local/bin outranks everything.
dotfiles_prepend_path "$FNM_DIR"
dotfiles_prepend_path "$HOME/.local/bin"

# A fixed default Node path gives SSH/builds Node without running fnm on startup.
if [ -r "$HOME/.config/dotfiles/node-path.sh" ]; then
  . "$HOME/.config/dotfiles/node-path.sh"
fi

# --- Headless server extras and prompt configuration -------------------------

if [ "${DOTFILES_PROFILE:-}" = debian-server ]; then
  . "$DOTFILES_DIR/shell/server/env.sh"
fi

if [ -f "$DOTFILES_DIR/secret/starship.toml" ]; then
  export STARSHIP_CONFIG="$DOTFILES_DIR/secret/starship.toml"
fi

export PATH

# Succeed unconditionally: a false last command would make sourcing this file
# look like a failure to the caller.
:
