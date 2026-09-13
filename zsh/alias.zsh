#!/bin/zsh

alias c="clear"
alias kill_dashboard="defaults write com.apple.dashboard mcx-disabled -boolean YES; killall Dock"

# Git
alias g="git"
# Go to the root folder of the repository
alias root="cd \"\$(git root || echo .)\""

# Installer
alias b="brew"

## Shell
alias ls="eza"
alias la="eza --all --long"
alias cat="bat"

alias _="sudo"
alias q="osascript -e 'tell application \"Terminal\" to quit'"
alias reload="exec \${SHELL} -l"

# NPM
alias n="npm"
alias nr="npm run"
alias nx="nocorrect pnpm exec nx"
alias p="nocorrect pnpm"

# Ops
alias d="docker"
alias ks="kubectl"

# DB
alias stop_mongo="kill -2 \$(pgrep mongo)"
alias m="mongod --dbpath=\"\${HOME}/.data/db\""

## Program
alias j="jrnl" # see https://github.com/maebert/jrnl | http://jrnl.sh
alias vscode="open -a 'visual studio code'"
alias zed="open -a /Applications/Zed.app -n"

# Network
alias rp="lsof -nP -iTCP | grep LISTEN" # Running ports
alias local_ip="ipconfig getifaddr en0"
alias distant_ip="curl -s http://checkip.dyndns.org/ | sed 's/[a-zA-Z<>/ :]//g'"
alias ip="echo -e \"Local IP: \$(local_ip); Distant IP: \$(distant_ip)\""

# Some useful scripts
alias dev="~/Documents/prog/dotfiles/scripts/devcontainer.sh"
alias update_repos="~/Documents/prog/dotfiles/scripts/update-repos.sh"
alias update_deps="~/Documents/prog/dotfiles/scripts/update-deps.sh"

# Add secret aliases
source ~/Documents/prog/dotfiles/zsh/secret/alias.zsh
