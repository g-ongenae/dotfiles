#! /bin/bash

# shellcheck disable=SC1090,SC1091,SC1117,SC2016

# Env

## GCloud

# The next lines updates PATH for the Google Cloud SDK.
if [ -f "$HOME/.gcloud/google-cloud-sdk/path.bash.inc" ]; then
	source "$HOME/.gcloud/google-cloud-sdk/path.bash.inc";
fi

# The next lines enables shell command completion for gcloud.
if [ -f "$HOME/.gcloud/google-cloud-sdk/completion.bash.inc" ]; then
	source "$HOME/.gcloud/google-cloud-sdk/completion.bash.inc";
fi

## Lang

### Haskell
PATH="$PATH:$HOME/Library/Haskell/bin"
PATH="$PATH:$HOME/.local/bin"

### Go Lang
# export GOPATH="$HOME/Documents/code/go"
# export GOBIN="$HOME/Documents/code/go/bin"

### Java
# JAVA_HOME=$(/usr/libexec/java_home)
# export JAVA_HOME

#### Derby
# export DERBY_HOME="/Users/go/Documents/code/derby/bin"
# export PATH="$DERBY_HOME/bin:$PATH"

### Python
# export PYTHONPATH="/Library/Python/2.7/site-packages/:$PYTHONPATH"

## Version Manager

### Node
### => AVN
# [[ -s "$HOME/.avn/bin/avn.sh" ]] && source "$HOME/.avn/bin/avn.sh"
### => NVM
NVM_DIR="$HOME/.nvm"
export NVM_DIR
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
### Yarn Global Modules
PATH="$PATH:$HOME/.config/yarn/global/node_modules/.bin"

### Yarn
export PATH="$PATH:$HOME/.config/yarn/global/node_modules/.bin"

### RVM
# [[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm"

### Kubernetes
# https://github.com/jonmosco/kube-ps1
source "/usr/local/opt/kube-ps1/share/kube-ps1.sh"
kubeoff # Only enable it when necessary

### Kubernetes
# https://github.com/jonmosco/kube-ps1
source "/usr/local/opt/kube-ps1/share/kube-ps1.sh"
kubeoff # Only enable it when necessary

## Shell

# Terminal prefix colors
NM="\[\033[0;38m\]"
HI="\[\033[0;37m\]"
HII="\[\033[0;36m\]"
SI="\[\033[0;33m\]"
TI="\[\033[1;31m\]"
IN="\[\033[0m\]"

function ___ps1
{
	# Only print host if different than (\h)
	if [[ "$HOSTNAME" == 'iMac-de-Petit.local' || "$HOSTNAME" == 'iMac-de-Petit.home' || "$HOSTNAME" == 'iMac-de-Petit' ]]; then
		h=''
	else
		h='$HOSTNAME'
	fi

	# Only print username if different than (\u)
	if [[ "$USER" == 'guillaumeongenae' ]]; then
		u='•'
	else
		u='$USER'
	fi

	# Get only the current or ~ if home
	if [[ "$PWD" == "/Users/$USER" ]]; then
		w='~'
	else
		w=${PWD##*/}
		! [[ $w == "" ]] || w='/'
	fi

	# Print branch name if in a repository, otherwise print ⨯
	if [[ -d "$PWD/.git" ]] || git rev-parse --git-dir > /dev/null 2>&1; then
		g=$(git rev-parse --abbrev-ref HEAD)
	else
		g='⨯'
	fi

  # Print the K8s namespace or nothing (this is to remove unwanted space)
  if [[ "$(kube_ps1)" == "" ]]; then
    k=''
  else
    k='$(kube_ps1) '
  fi

	PS1="$NM[ $HI$u $HII$h $SI$w $TI$g$NM $k]$IN "
  export PS1
}

PROMPT_COMMAND=___ps1
export PROMPT_COMMAND

export PATH
