# Add Pyenv path
export PYENV_ROOT="${HOME}/.pyenv"
export PATH="${PYENV_ROOT}/bin:${PATH}"
eval "$(pyenv init --path)"

# Load nvm updater
autoload -U add-zsh-hook
load-nvmrc() {
  local NODE_VERSION="$(nvm version)"
  local NVMRC_PATH="$(nvm_find_nvmrc)"

  if [ -n "$NVMRC_PATH" ]; then
    local NVMRC_NODE_VERSION=$(nvm version "$(cat "${NVMRC_PATH}")")

    if [ "${NVMRC_NODE_VERSION}" = "N/A" ]; then
      nvm install
    elif [ "${NVMRC_NODE_VERSION}" != "${NODE_VERSION}" ]; then
      nvm use
    fi
  elif [ "${NODE_VERSION}" != "$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}

add-zsh-hook chpwd load-nvmrc
load-nvmrc
