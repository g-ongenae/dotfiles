# Env

## Lang

### Go Lang
export GOPATH="$HOME/Documents/code/go"
export GOBIN="$HOME/Documents/code/go/bin"

### Python
export PYTHONPATH="/Library/Python/2.7/site-packages/:$PYTHONPATH"

## Version Manager

### Node
### => AVN
[[ -s "$HOME/.avn/bin/avn.sh" ]] && source "$HOME/.avn/bin/avn.sh"
### => NVM
export NVM_DIR="$HOME/.nvm"
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"

### RVM
[[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm"

## Shell

# Terminal prefix colors
NM="\[\033[0;38m\]"
HI="\[\033[0;37m\]"
HII="\[\033[0;36m\]"
SI="\[\033[0;33m\]"
TI="\[\033[1;31m\]"
IN="\[\033[0m\]"

function ___ps1 {
	# Only print host if different than (\h)
	if [[ "$HOSTNAME" == 'on.local' || "$HOSTNAME" == 'on.home' || "$HOSTNAME" == 'on' ]]; then
		h=''
	else
		h='$HOSTNAME'
	fi

	# Only print username if different than (\u)
	if [[ "$USER" == 'go' ]]; then
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

	export PS1="$NM[ $HI$u $HII$h $SI$w $TI$g$NM ] $IN"
}

export PROMPT_COMMAND=___ps1