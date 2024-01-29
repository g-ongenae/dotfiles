# Add homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# Add Pyenv path
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"

# Created by `pipx` on 2024-01-18 15:57:16
export PATH="$PATH:/Users/guillaumeongenae/.local/bin"
