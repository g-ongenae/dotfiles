#! /bin/zsh

#----------------------------------------------------------------
# Change the language of the terminal to German
LC_ALL="de_DE.UTF-8"
LANG="de_DE.UTF-8"
LANGUAGE="de_DE.UTF-8"
export LC_ALL LANG LANGUAGE

#----------------------------------------------------------------
# Disable open collective messages and analytics

# https://github.com/zloirock/core-js/issues/548#issuecomment-495388335
export ADBLOCK="1"

# https://docs.brew.sh/Analytics#opting-out
export HOMEBREW_NO_ANALYTICS=1

#----------------------------------------------------------------
# Enable zsh

ZDOTDIR="${HOME}/Documents/prog/dotfiles/run"
export ZDOTDIR

# Set up Byobu Tmux
export BYOBU_PREFIX=/usr/local

#----------------------------------------------------------------
# Source some scripts for languages...

## GCloud

# The next lines updates PATH for the Google Cloud SDK.
if [ -f "${HOME}/.gcloud/google-cloud-sdk/path.zsh.inc" ] ; then
	source "${HOME}/.gcloud/google-cloud-sdk/path.zsh.inc"
fi

# The next lines enables shell command completion for gcloud.
if [ -f "${HOME}/.gcloud/google-cloud-sdk/completion.zsh.inc" ] ; then
	source "${HOME}/.gcloud/google-cloud-sdk/completion.zsh.inc"
fi

## Kubernetes
# https://github.com/jonmosco/kube-ps1
source "/usr/local/opt/kube-ps1/share/kube-ps1.sh"

# Load RVM into a shell session *as a function*
[[ -s "${HOME}/.rvm/scripts/rvm" ]] && source "${HOME}/.rvm/scripts/rvm"

#----------------------------------------------------------------
# Update PATH & other variables

### Go Lang
GOPATH="${HOME}/Documents/prog/go"
GOBIN="${HOME}/Documents/prog/go/bin"
export GOPATH GOBIN

### Haskell
PATH="${PATH}:${HOME}/Library/Haskell/bin"
PATH="${PATH}:${HOME}/.local/bin"

### Java
JAVA_HOME=$(/usr/libexec/java_home)
export JAVA_HOME

#### Derby
DERBY_HOME="${HOME}/Documents/prog/derby/bin"
PATH="${PATH}:${DERBY_HOME}/bin"
export DERBY_HOME

### Node (NVM)
NVM_DIR="${HOME}/.nvm"
export NVM_DIR

### Python
# PYTHONPATH="/Library/Python/2.7/site-packages/:${PYTHONPATH}"
PYENV_ROOT="${HOME}/.pyenv"
PATH="${PYENV_ROOT}/bin:${PATH}"
export PYTHONPATH PYENV_ROOT

# Rust
source "${HOME}/.cargo/env"
PATH="${HOME}/.cargo/bin:${PATH}"

### RVM
GEM_HOME="${HOME}/.gem"
export GEM_HOME

### Yarn Global Modules
PATH="${PATH}:${HOME}/.config/yarn/global/node_modules/.bin"

### Bit (bit.dev)
PATH="$PATH:$HOME/bin"

### Other
PATH="${PATH}:/usr/local/opt/sqlite/bin"
PATH="${PATH}:/usr/local/opt/openssl/bin"
PATH="${PATH}:/usr/local/opt/sphinx-doc/bin"
PATH="${PATH}:/usr/local/opt/nss/bin"

### RVM
# Make sure this is the last PATH variable change.
PATH="${PATH}:${HOME}/.rvm/bin"

#----------------------------------------------------------------
# Export PATH
export PATH MANPATH
