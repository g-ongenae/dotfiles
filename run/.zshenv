
#----------------------------------------------------------------
# Enable Zsh

# Specify the folder to load the env files for Zsh
ZDOTDIR="~/Documents/prog/dotfiles/run/"
export ZDOTDIR

#----------------------------------------------------------------
# Source some scripts for languages...

# Load RVM into a shell session *as a function*
[[ -s "$HOME/.rvm/scripts/rvm" ]] && source "$HOME/.rvm/scripts/rvm"

# Load avn
[[ -s "$HOME/.avn/bin/avn.sh" ]] && source "$HOME/.avn/bin/avn.sh"

# added by travis gem
[ -f "$HOME/.travis/travis.sh" ] && source "$HOME/.travis/travis.sh"

#----------------------------------------------------------------
# Update PATH

# Add RVM to PATH for scripting.
# Make sure this is the last PATH variable change.
PATH="$PATH:$HOME/.rvm/bin"

#----------------------------------------------------------------
# Export PATH
export PATH
