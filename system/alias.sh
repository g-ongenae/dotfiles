#! /bin/bash

# shellcheck disable=SC1117

## Change Directory
  # Go to the root folder of the repository
alias root="cd \"\$(git rev-parse --show-toplevel || echo .)\""

## Program
alias vscode="open -a 'visual studio code'"
alias j="jrnl" # see https://github.com/maebert/jrnl | http://jrnl.sh

## Shell
alias c="clear"
alias kill_dashboard="defaults write com.apple.dashboard mcx-disabled -boolean YES; killall Dock"
alias ls="eza"
alias la="eza --all --long"
alias tree="tree -CF"
alias cat="bat"
alias _="sudo"
alias q="osascript -e 'tell application \"Terminal\" to quit'"
alias reload="exec \${SHELL} -l"
alias b="brew"

## Move
function trash
{
  mv "$@" ~/.Trash
}

## NPM
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
