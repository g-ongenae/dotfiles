#! /bin/bash

# shellcheck disable=SC1117

# Aliases

## Clear
alias c="clear"
alias kill_dashboard="defaults write com.apple.dashboard mcx-disabled -boolean YES; killall Dock"

## Change Directory
alias cd..="cd .."
alias prog="cd ~/Documents/prog"
alias days="cd ~/Documents/prog/days/"
alias dotfiles="cd ~/Documents/prog/dotfiles/"
alias io="cd ~/Documents/prog/g-ongenae.github.io"
alias other="cd ~/Documents/other"
alias study="cd ~/Documents/study"
alias work="cd ~/Documents/work"
alias write="cd ~/Documents/write"
  # Go to the root folder of the repository
alias root="cd \"\$(git rev-parse --show-toplevel || echo .)\""

## List
alias ls="exa"
alias la="exa --all --long"
alias ls..="ls .."
alias ls="ls \${LS_OPTIONS} -GhF"
alias ll="ls \${LS_OPTIONS} -GlAhF"
alias lr="ls \${LS_OPTIONS} -GRAhF"
alias lf="ls \${LS_OPTIONS} -GRAhF | grep ':$' | sed -e 's/:$//' -e 's/[^-][^\/]*\//--/g' -e 's/^/   /' -e 's/-/|/'"

## Program
alias vscode="open -a 'visual studio code'"
alias typora="open -a typora"
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
alias cat="bat"
alias _="sudo"
alias q="osascript -e 'tell application \"Terminal\" to quit'"
alias reload="exec \${SHELL} -l"

# Installer
alias b="brew"

## Yarn & NPM
alias fprettier="npx prettier --tab-width 1 --write package*.json"
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
alias stop_mongo="kill -2 \$(pgrep mongo)"
alias m="mongod --dbpath=\"\${HOME}/.data/db\""

# Jupyter & Python
alias ju="jupyter"
alias py="python3"

# Scripts
alias chenv="~/Documents/work/scripts/telepresence/change_env.sh"
alias sw_prod="chenv -P algoan-prod -d"
alias sw_preprod="chenv -P algoan-preprod -d"
alias sw_dev="chenv -P algoan-dev -C algoan-dev-v2"

alias deploy_me="~/Documents/work/scripts/telepresence/deploy-me.sh"
alias release="bash ~/Documents/work/scripts/openRelease/index.sh"
alias upade_node="bash ~/Documents/prog/dotfiles/scripts/updateNodeVersion.sh"
alias update_wallpaper="bash ~/Documents/prog/dotfiles/scripts/update-all-wallpapers.sh"
