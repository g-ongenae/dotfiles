# Add homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# Add Pyenv path
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init --path)"
