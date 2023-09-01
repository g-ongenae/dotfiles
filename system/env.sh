#! /bin/bash

# shellcheck disable=SC1117,SC2016,SC1090,SC1091

# Env

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

# Auto completion for kubectl
# if [[ -r "/usr/local/etc/profile.d/bash_completion.sh" ]] ; then
# 	source "/usr/local/etc/profile.d/bash_completion.sh" ;
# fi

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
	local PC_NAME="MacBook-Pro-de-Guillaume"

	if [[
		"${HOSTNAME}" == "${PC_NAME}.local" ||
		"${HOSTNAME}" == "${PC_NAME}.home" ||
		"${HOSTNAME}" == "${PC_NAME}"
	]]; then
		h=''
	else
		h='$HOSTNAME'
	fi

	# Only print username if different than (\u)
	if [[ "$USER" == 'go' ]] ; then
		u='•'
	else
		u='$USER'
	fi

	# Get only the current or ~ if home
	if [[ "$PWD" == "/Users/$USER" ]] ; then
		w='~'
	else
		w=${PWD##*/}
		! [[ $w == "" ]] || w='/'
	fi

	# Print branch name if in a repository, otherwise print ⨯
	if [[ -d "$PWD/.git" ]] || git rev-parse --git-dir > /dev/null 2>&1 ; then
		g=$(git rev-parse --abbrev-ref HEAD)
	else
		g='⨯'
	fi

  # Print the K8s namespace or nothing (this is to remove unwanted space)
  if [[ "$(kube_ps1)" == "" ]] ; then
    k=''
  else
    k='$(kube_ps1) '
  fi

	PS1="${NM}[ ${HI}${u} ${HII}${h} ${SI}${w} ${TI}${g}${NM} ${k}]${IN} "
  export PS1
}

# PROMPT_COMMAND=___ps1
# export PROMPT_COMMAND

export PATH MANPATH

# export -f ___ps1
