#! /bin/zsh

# Alias

alias c="clear"
alias kill_dashboard="defaults write com.apple.dashboard mcx-disabled -boolean YES; killall Dock"

# Git
alias g="git"
# Go to the root folder of the repository
alias root="cd \"\$(git rev-parse --show-toplevel || echo .)\""

## Shell
alias _="sudo"
alias q="osascript -e 'tell application \"Terminal\" to quit'"
alias reload="exec \${SHELL} -l"

## Yarn & NPM
alias n="npm"
alias nr="npm run"
alias y="yarn"
alias sw="swagger-editor-live"

## Haskell
alias hs="ghc"
alias hs_doc="open \${HOME}/Library/Haskell/doc/index.html"

# Ops
alias ci="circleci"
alias d="docker"
alias ks="kubectl"

# DB
alias m="mongod"

# Jupyter & Python
alias ju="jupyter"
alias py="python3"

## Program
alias vscode="open -a 'visual studio code'"
alias typora="open -a typora"
alias j="jrnl" # see https://github.com/maebert/jrnl | http://jrnl.sh
alias h="open http://127.0.0.1:8080 & http-server"

# Scripts
alias release="bash ~/Documents/prog/dotfiles/scripts/openRelease.sh"
alias upade_node="bash ~/Documents/prog/dotfiles/scripts/updateNodeVersion.sh"

