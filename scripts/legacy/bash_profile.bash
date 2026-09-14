#! /bin/bash

# shellcheck disable=SC1090,SC2128

# Initialize fuzzy finder
eval "$(fzf --bash)"

# Change default starship.toml file location
export STARSHIP_CONFIG="${HOME}/Documents/prog/dotfiles/secret/starship.toml"

# Initialize starship prompting
eval "$(starship init bash)"

# Initialize zoxide aliases
eval "$(zoxide init bash)"

# Resolve DOTFILES_DIR
READLINK=$(which greadlink || which readlink)
CURRENT_SCRIPT=$BASH_SOURCE

if [[ -n $CURRENT_SCRIPT && -x "$READLINK" ]] ; then
  SCRIPT_PATH=$($READLINK "$CURRENT_SCRIPT")
  DOTFILES_DIR=$(dirname "$(dirname "$SCRIPT_PATH")")
else
  echo "Unable to find dotfiles, exiting."
  return
fi

# source the dotfiles
for DOTFILE in "$DOTFILES_DIR"/system/{env,alias}.sh ; do
	[ -f "$DOTFILE" ] && source "$DOTFILE"
done

# Clean up
unset READLINK CURRENT_SCRIPT SCRIPT_PATH DOTFILE

# Export
export DOTFILES_DIR DOTFILES_EXTRA_DIR

# Add autocompletion
if type brew 2&>/dev/null ; then
  for completion_file in "$(brew --prefix)/etc/bash_completion.d/"* ; do
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
