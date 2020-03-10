#----------------------------------------------------------------
# Enable zsh

ZDOTDIR="${HOME}/Documents/prog/dotfiles/run"
export ZDOTDIR

#----------------------------------------------------------------
# Source some scripts for languages...

## GCloud

# The next lines updates PATH for the Google Cloud SDK.
if [ -f "$HOME/.gcloud/google-cloud-sdk/path.zsh.inc" ] ; then
	source "$HOME/.gcloud/google-cloud-sdk/path.zsh.inc"
fi

# The next lines enables shell command completion for gcloud.
if [ -f "$HOME/.gcloud/google-cloud-sdk/completion.zsh.inc" ] ; then
	source "$HOME/.gcloud/google-cloud-sdk/completion.zsh.inc"
fi

## Kubernetes
# https://github.com/jonmosco/kube-ps1
source "/usr/local/opt/kube-ps1/share/kube-ps1.sh"

# Load RVM into a shell session *as a function*
[[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm"

# Load avn
[[ -s "$HOME/.avn/bin/avn.sh" ]] && source "$HOME/.avn/bin/avn.sh"

# Load nvm
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"

# added by travis gem
[ -f "$HOME/.travis/travis.sh" ] && source "$HOME/.travis/travis.sh"

#----------------------------------------------------------------
# Update PATH & other variables

# z
PATH="${HOME}/Documents/prog/dotfiles/scripts/z/z.sh:${PATH}"
MANPATH="${MANPATH}:${HOME}/Documents/prog/dotfiles/scripts/z/z.1"

### Go Lang
GOPATH="$HOME/Documents/prog/go"
GOBIN="$HOME/Documents/prog/go/bin"
export GOPATH GOBIN

### Haskell
PATH="$PATH:$HOME/Library/Haskell/bin"
PATH="$PATH:$HOME/.local/bin"

### Java
JAVA_HOME=$(/usr/libexec/java_home)
export JAVA_HOME

#### Derby
DERBY_HOME="${HOME}/Documents/prog/derby/bin"
PATH="$PATH:$DERBY_HOME/bin"
export DERBY_HOME

### Node (NVM)
NVM_DIR="$HOME/.nvm"
export NVM_DIR

### Python
# PYTHONPATH="/Library/Python/2.7/site-packages/:$PYTHONPATH"
# export PYTHONPATH

### RVM
GEM_HOME="$HOME/.gem"
export GEM_HOME

### Yarn Global Modules
PATH="$PATH:$HOME/.config/yarn/global/node_modules/.bin"

### Other
PATH="$PATH:/usr/local/opt/sqlite/bin"
PATH="$PATH:/usr/local/opt/openssl/bin"
PATH="$PATH:/usr/local/opt/sphinx-doc/bin"
PATH="$PATH:/usr/local/opt/nss/bin"

### RVM
# Make sure this is the last PATH variable change.
PATH="$PATH:$HOME/.rvm/bin"

#----------------------------------------------------------------
# Export PATH
export PATH MANPATH
