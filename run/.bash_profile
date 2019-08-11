#! /bin/bash

# shellcheck disable=SC1090,SC2128

# Resolve DOTFILES_DIR
READLINK=$(which greadlink || which readlink)
CURRENT_SCRIPT=$BASH_SOURCE

if [[ -n $CURRENT_SCRIPT && -x "$READLINK" ]] ; then
  SCRIPT_PATH=$($READLINK -f "$CURRENT_SCRIPT")
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
  for completion_file in $(brew --prefix)/etc/bash_completion.d/* ; do
    [ -f "$completion_file" ] && source "$completion_file"
  done
fi

# Ask for today work
new_day
