# shellcheck shell=sh
# Aliases and small helpers shared by interactive Bash and Zsh.
#
# Sourced only at a prompt, never into build/SSH command environments, so
# scripts never depend on anything defined here.

# --- Short names for everyday commands ---------------------------------------

alias g='git'
alias c='clear'
alias _='sudo'
alias reload='exec "${SHELL:-/bin/bash}" -l'
alias n='npm'
alias nr='npm run'

# --- Modern replacements, only when the tool is installed --------------------

command -v eza > /dev/null 2>&1 && alias ls='eza' && alias la='eza --all --long'

# Debian ships bat as `batcat`; give it both names there.
if command -v bat > /dev/null 2>&1; then
  alias cat='bat'
elif command -v batcat > /dev/null 2>&1; then
  alias bat='batcat'
  alias cat='batcat'
fi

# Same story for fd, which Debian ships as `fdfind`.
if ! command -v fd > /dev/null 2>&1 && command -v fdfind > /dev/null 2>&1; then
  alias fd='fdfind'
fi

# --- Helpers -----------------------------------------------------------------

# Jump to the top of the current Git working tree.
root() {
  dotfiles_git_root=$(git rev-parse --show-toplevel) || return
  cd "$dotfiles_git_root" || return
  unset dotfiles_git_root
}

# Run the workspace-local Nx, searching upwards for node_modules/.bin/nx so it
# works from any package of a monorepo.
#
# This has to be a function, not an alias: nx-completion runs `nx --help` from
# inside a completion function, where aliases are invisible, so an alias leaves
# `nx` with no completion at all.
nx() {
  dotfiles_nx_dir=$PWD

  # Walk up one directory at a time by trimming the last path component.
  while [ -n "$dotfiles_nx_dir" ]; do
    if [ -x "$dotfiles_nx_dir/node_modules/.bin/nx" ]; then
      "$dotfiles_nx_dir/node_modules/.bin/nx" "$@"
      return
    fi

    dotfiles_nx_dir=${dotfiles_nx_dir%/*}
  done

  echo "nx: no node_modules/.bin/nx found in $PWD or its parents" >&2
  return 127
}

# --- Repository maintenance --------------------------------------------------

update_repos() { bash "$DOTFILES_DIR/scripts/update-repos.sh" "$@"; }
update_deps() { bash "$DOTFILES_DIR/install.sh" --update "$@"; }

# Succeed unconditionally, so sourcing this file never looks like a failure.
:
