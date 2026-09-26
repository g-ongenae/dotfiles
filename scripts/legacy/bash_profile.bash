#! /bin/bash
# The previous ~/.bash_profile, kept for reference only.
#
# Nothing installs or sources this file any more: its role is now split between
# shell/common/init.sh (environment) and shell/interactive/init.bash (prompt).
# It is preserved verbatim in behaviour so an older machine can be compared
# against it; prefer the files under shell/ for anything new.
#
# SC1090  sources a path built at runtime
# SC2128  reads $BASH_SOURCE without an index
# SC2230  uses `which` rather than `command -v`
# shellcheck disable=SC1090,SC2128,SC2230

# Initialize fuzzy finder
eval "$(fzf --bash)"

# Change default starship.toml file location
export STARSHIP_CONFIG="${HOME}/Documents/prog/dotfiles/secret/starship.toml"

# Initialize starship prompting
eval "$(starship init bash)"

# Initialize zoxide aliases
eval "$(zoxide init bash)"

# Resolve DOTFILES_DIR
# Follow the symlink this file was installed as, then take its grandparent
# directory: <checkout>/system/<file> means the checkout is two levels up.
READLINK=$(which greadlink || which readlink)
CURRENT_SCRIPT=$BASH_SOURCE

if [[ -n $CURRENT_SCRIPT && -x "$READLINK" ]]; then
  SCRIPT_PATH=$($READLINK "$CURRENT_SCRIPT")
  DOTFILES_DIR=$(dirname "$(dirname "$SCRIPT_PATH")")
else
  echo "Unable to find dotfiles, exiting."
  return
fi

# source the dotfiles
for DOTFILE in "$DOTFILES_DIR"/system/{env,alias}.sh; do
  [ -f "$DOTFILE" ] && source "$DOTFILE"
done

# Clean up
unset READLINK CURRENT_SCRIPT SCRIPT_PATH DOTFILE

# Export
export DOTFILES_DIR DOTFILES_EXTRA_DIR

# Add autocompletion
# Sourced file by file, which the current setup deliberately no longer does.
if type brew 2 &> /dev/null; then
  for completion_file in "$(brew --prefix)/etc/bash_completion.d/"*; do
    [ -f "$completion_file" ] && source "$completion_file"
  done
fi

export VOLTA_HOME="${HOME}/.volta"
PATH="${VOLTA_HOME}/bin:${PATH}"

## Kubernetes
PATH="${KREW_ROOT:-$HOME/.krew}/bin:${PATH}"

## Homebrew binaries
PATH="/opt/homebrew/bin:${PATH}"

# pnpm
export PNPM_HOME="/Users/go/Library/pnpm"
# Prepend only when it is not already there, so re-sourcing cannot duplicate it.
case ":$PATH:" in
  *":$PNPM_HOME/bin:"*) ;;
  *) export PATH="$PNPM_HOME/bin:$PATH" ;;
esac

# Socket CLI completion for "socket"
if [ -f "/Users/go/.local/share/socket/completion/socket-completion.bash" ]; then
  # Load the tab completion script
  source "/Users/go/.local/share/socket/completion/socket-completion.bash"
  # Tell bash to use this function for tab completion of this function
  complete -F _socket_completion socket
fi

export PATH
