# shellcheck shell=bash
# Prompt setup for Bash. Sourced from ~/.bashrc, after the user's own settings.

# Do nothing at all in a noninteractive shell, and only once per session.
case $- in *i*) ;; *) return 0 ;; esac
[ "${DOTFILES_BASH_INITIALIZED:-}" = 1 ] && return 0
DOTFILES_BASH_INITIALIZED=1

# Supersede older t3 definitions in the user's existing .bashrc.
. "$DOTFILES_DIR/shell/common/t3.sh"
. "$DOTFILES_DIR/shell/interactive/aliases.sh"

# --- History -----------------------------------------------------------------

HISTSIZE=50000
HISTFILESIZE=100000
# Record neither duplicates nor commands typed with a leading space.
HISTCONTROL=ignoreboth
# Append instead of overwriting, so parallel shells do not lose each other's history.
shopt -s histappend

# --- Completion and prompt integrations --------------------------------------

# Modern completion/prompt scripts use features unavailable in Apple's Bash
# 3.2. Keep its environment and aliases usable; `bash` uses Homebrew's version.
if ((BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 2))); then

  # Load completion through its framework entrypoint, never file by file.
  if [ "${DOTFILES_PROFILE:-}" = macos ]; then
    if [ -r "${HOMEBREW_PREFIX:-}/etc/profile.d/bash_completion.sh" ]; then
      . "$HOMEBREW_PREFIX/etc/profile.d/bash_completion.sh"
    fi
  elif [ -r /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
  fi

  # Node version switching on directory change.
  command -v fnm > /dev/null 2>&1 && eval "$(fnm env --use-on-cd --shell bash)"

  # fzf keybindings: recent versions print them, older Debian ships files.
  if command -v fzf > /dev/null 2>&1; then
    if dotfiles_fzf=$(fzf --bash 2> /dev/null); then
      eval "$dotfiles_fzf"
    elif [ -r /usr/share/doc/fzf/examples/key-bindings.bash ]; then
      . /usr/share/doc/fzf/examples/key-bindings.bash
      . /usr/share/doc/fzf/examples/completion.bash
    fi
    unset dotfiles_fzf
  fi

  command -v zoxide > /dev/null 2>&1 && eval "$(zoxide init bash)"
  command -v starship > /dev/null 2>&1 && eval "$(starship init bash)"
  command -v atuin > /dev/null 2>&1 && eval "$(atuin init bash)"
fi

# --- Per-profile and per-machine additions -----------------------------------

case "${DOTFILES_PROFILE:-}" in
  macos) . "$DOTFILES_DIR/shell/macos/interactive.sh" ;;
  fedora | debian-server) . "$DOTFILES_DIR/shell/linux/interactive.sh" ;;
esac

# Personal, uncommitted additions for this machine.
if [ -r "$HOME/.config/dotfiles/local.bash" ]; then
  . "$HOME/.config/dotfiles/local.bash"
fi

# Succeed unconditionally, so sourcing this file never looks like a failure.
:
