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
source "/opt/homebrew/opt/kube-ps1/share/kube-ps1.sh"

#----------------------------------------------------------------
# Update PATH & other variables

### Python
# PYTHONPATH="/Library/Python/2.7/site-packages/:${PYTHONPATH}"
PYENV_ROOT="$HOME/.pyenv"
PATH="$PYENV_ROOT/bin:$PATH"
export PYTHONPATH PYENV_ROOT

### Other
PATH="$PATH:/usr/local/opt/openssl/bin"
PATH="$PATH:/usr/local/opt/nss/bin"
PATH="$PATH:/usr/local/sbin"

#----------------------------------------------------------------
# Export PATH
export PATH MANPATH
