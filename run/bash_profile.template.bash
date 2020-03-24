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

# Load nvm
export NVM_DIR="${HOME}/.nvm"
if [ -s "/usr/local/opt/nvm/nvm.sh" ] ; then
  source "/usr/local/opt/nvm/nvm.sh"
fi
if [ -s "/usr/local/opt/nvm/etc/bash_completion.d/nvm" ] ; then
  source "/usr/local/opt/nvm/etc/bash_completion.d/nvm"
fi

# Resolve DOTFILES_DIR
READLINK=$(which greadlink || which readlink)
CURRENT_SCRIPT=$BASH_SOURCE

if [[ -n ${CURRENT_SCRIPT} && -x "${READLINK}" ]] ; then
  SCRIPT_PATH=$(${READLINK} "${CURRENT_SCRIPT}")
  DOTFILES_DIR=$(dirname "$(dirname "${SCRIPT_PATH}")")
else
  echo "Unable to find dotfiles, exiting."
  return
fi

# source the dotfiles
for DOTFILE in "${DOTFILES_DIR}"/system/{function,env,alias}.sh ; do
	[ -f "${DOTFILE}" ] && source "${DOTFILE}"
done

for DOTFILE in "${DOTFILES_DIR}"/git/{function,alias}.sh ; do
	[ -f "${DOTFILE}" ] && source "${DOTFILE}"
done

for DOTFILE in "${DOTFILES_DIR}"/secret/{function,alias}.sh ; do
	[ -f "${DOTFILE}" ] && source "${DOTFILE}"
done

# Clean up
unset READLINK CURRENT_SCRIPT SCRIPT_PATH DOTFILE

# Export
export DOTFILES_DIR DOTFILES_EXTRA_DIR

# Add autocompletion
if type brew 2&>/dev/null ; then
  for COMPLETION_FILE in "$(brew --prefix)/etc/bash_completion.d/"* ; do
    [ -f "${COMPLETION_FILE}" ] && source "${COMPLETION_FILE}"
  done
fi
