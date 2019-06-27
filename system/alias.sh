#! /bin/bash

# shellcheck disable=SC1117

# Aliases

## Clear
alias c="clear"
alias kill_dashboard="defaults write com.apple.dashboard mcx-disabled -boolean YES; killall Dock"

## Change Directory
alias cd..="cd .."
alias prog="cd ~/Documents/code"
alias days="cd ~/Documents/code/days/"
alias dotfiles="cd ~/Documents/code/dotfiles/"
alias io="cd ~/Documents/code/g-ongenae.github.io"
alias other="cd ~/Documents/other"
# alias study="cd ~/Documents/study"
alias work="cd ~/Documents/work"
# alias write="cd ~/Documents/write"

## List
alias ls..="ls .."
alias ls="ls \${LS_OPTIONS} -GhF"
alias ll="ls \${LS_OPTIONS} -GlAhF"
alias la="ls \${LS_OPTIONS} -GaAhF"
alias lr="ls \${LS_OPTIONS} -GRAhF"
alias lf="ls \${LS_OPTIONS} -GRAhF | grep ':$' | sed -e 's/:$//' -e 's/[^-][^\/]*\//--/g' -e 's/^/   /' -e 's/-/|/'"

## Program
alias vscode="open -a 'visual studio code'"
# alias typora="open -a typora"
alias j="jrnl" # see https://github.com/maebert/jrnl | http://jrnl.sh
alias h="open http://127.0.0.1:8080 & http-server"

## Remove
alias ri="rm -I"
alias rf="rm -f"
alias rr="rm -R"

## Tree
alias tree..="tree .."
alias tree="tree -CF"
alias tre3="tree -CF -L 3"
alias tred="tree -CF -d"
alias trei="tree -CF -I 'node_modules'"
alias trej="tree -CF -o tree.log -j"
alias trel="tree -CF -p"
alias tres="tree -CF | less"
alias tret="tree -CF -tp"

## Shell
alias _="sudo"
alias q="osascript -e 'tell application \"Terminal\" to quit'"
alias reload="exec \${SHELL} -l"

## Yarn & NPM
alias n="npm"
alias nr="npm run"
alias y="yarn"
# alias yr="yarn run"
alias sw="swagger-editor-live"

# Ops
alias ci="circleci"
alias d="docker"
alias ks="kubectl"

# DB
alias m="mongod"
