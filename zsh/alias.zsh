#! /bin/zsh

# Alias

alias c="clear"
alias kill_dashboard="defaults write com.apple.dashboard mcx-disabled -boolean YES; killall Dock"

# Git
alias g="git"
# Go to the root folder of the repository
alias root="cd \"\$(git rev-parse --show-toplevel || echo .)\""

# Installer
alias b="brew"

## Shell
alias _="sudo"
alias q="osascript -e 'tell application \"Terminal\" to quit'"
alias reload="exec \${SHELL} -l"

## Yarn & NPM
alias fprettier="npx prettier --tab-width 1 --write package*.json"
alias n="npm"
alias nr="npm run"
alias nls='npm list -g --depth=0'
alias y="yarn"
alias sw="swagger-editor-live"

## Haskell
alias hs="ghc"
alias hs_doc="open \${HOME}/Library/Haskell/doc/index.html"

# Ops
alias ci="circleci"
alias d="docker"
alias dbuild="docker build -t \"\${PWD##*/}\" \
  --build-arg NODE_ENV=\"production\" \
  --build-arg NPM_TOKEN=\"\$(sed -e 's/\/\/registry.npmjs.org\/:_authToken=//' ~/.npmrc | head -1)\" ."
alias drun="docker run --rm -it -p 8080:8080 \"\${PWD##*/}\""
alias ks="kubectl"

# DB
alias stop-mongod="kill -2 \$(pgrep mongo)"
alias m="mongod --dbpath=\"\${HOME}/.data/db\""

# Jupyter & Python
alias ju="jupyter"
alias p="pipenv"
alias py="pipenv run python"

## Program
alias vscode="open -a 'visual studio code'"
alias typora="open -a typora"
alias j="jrnl" # see https://github.com/maebert/jrnl | http://jrnl.sh
alias h="open http://127.0.0.1:8080 & http-server"

# Scripts
alias chenv="~/Documents/work/scripts/telepresence/change_env.sh"
alias deploy_me="~/Documents/work/scripts/telepresence/deploy-me.sh"
alias release="bash ~/Documents/work/scripts/openRelease/index.sh"
alias upade_node="bash ~/Documents/prog/dotfiles/scripts/updateNodeVersion.sh"
alias update_wallpaper="bash ~/Documents/prog/dotfiles/scripts/updateWallpaper.sh"

# Network
alias rp="lsof -nP -iTCP | grep LISTEN" # Running ports
alias local_ip="ipconfig getifaddr en0"
alias distant_ip="curl -s http://checkip.dyndns.org/ | sed 's/[a-zA-Z<>/ :]//g'"
alias ip="echo -e \"Local IP: $(local_ip); Distant IP: $(distant_ip)\""
