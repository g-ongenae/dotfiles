#! /bin/bash

# shellcheck disable=SC1117,SC2016,SC1090,SC1091

# Env

#----------------------------------------------------------------
# Ensure we use English
LANGUAGE="en_US.UTF-8"
LANG="en_US.UTF-8"
LC_ALL="en_US.UTF-8"
export LC_ALL LANG LANGUAGE

#----------------------------------------------------------------
# Disable open collective messages and analytics

# https://github.com/zloirock/core-js/issues/548#issuecomment-495388335
export ADBLOCK="1"

# https://docs.brew.sh/Analytics#opting-out
export HOMEBREW_NO_ANALYTICS=1

#----------------------------------------------------------------

# To add alias of zoxide (z)
# https://github.com/ajeetdsouza/zoxide#bash
eval "$(zoxide init bash)"

## GCloud

# The next lines updates PATH for the Google Cloud SDK.
if [ -f "$HOME/.gcloud/google-cloud-sdk/path.bash.inc" ] ; then
	source "$HOME/.gcloud/google-cloud-sdk/path.bash.inc"
fi

# The next lines enables shell command completion for gcloud.
if [ -f "$HOME/.gcloud/google-cloud-sdk/completion.bash.inc" ] ; then
	source "$HOME/.gcloud/google-cloud-sdk/completion.bash.inc"
fi

## Kubernetes

# Autocompletion
if [ -n "$(command -v kubectl)" ] ; then
	source <(kubectl completion bash)
fi

# Prompt
# https://github.com/jonmosco/kube-ps1
source "/opt/homebrew/opt/kube-ps1/share/kube-ps1.sh"

## Git

## What a pain
alias g="git"

# Autocompletion
if [ -f $(brew --prefix)/opt/bash-completion/etc/profile.d/bash_completion.sh ]; then
	. $(brew --prefix)/opt/bash-completion/etc/profile.d/bash_completion.sh
fi

## Lang

### Python
# PYTHONPATH="/Library/Python/2.7/site-packages/:$PYTHONPATH"
# export PYTHONPATH
# Add Pyenv path
PYENV_ROOT="$HOME/.pyenv"
PATH="$PYENV_ROOT/bin:$PATH"
export PYENV_ROOT
eval "$(pyenv init --path)"

## Version Manager

## Other
PATH="/usr/local/opt/openssl/bin:$PATH"
PATH="/usr/local/opt/sphinx-doc/bin:$PATH"
PATH="/usr/local/opt/nss/bin:$PATH"

### Kubernetes
# https://github.com/jonmosco/kube-ps1
source "/opt/homebrew/opt/kube-ps1/share/kube-ps1.sh"
kubeoff # Only enable it when necessary


export PATH MANPATH
