#! /bin/bash

# shellcheck disable=SC1090,SC2128

# Change default starship.toml file location
export STARSHIP_CONFIG="${HOME}/Documents/prog/dotfiles/run/starship.toml"

# Initialize starship prompting
eval "$(starship init bash)"

# Initialize zoxide aliases
eval "$(zoxide init bash)"

# Navi - https://github.com/denisidoro/navi
eval "$(navi widget bash)"

# Node env - https://github.com/nodenv/nodenv
eval "$(nodenv init -)"

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
for DOTFILE in "$DOTFILES_DIR"/system/{function,env,alias}.sh ; do
	[ -f "$DOTFILE" ] && source "$DOTFILE"
done

for DOTFILE in "$DOTFILES_DIR"/git/{function,alias}.sh ; do
	[ -f "$DOTFILE" ] && source "$DOTFILE"
done

for DOTFILE in "$DOTFILES_DIR"/secret/{function,alias}.sh ; do
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
