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
  # Run all NPM script to format, lint and test
alias nr_all="npm run prettier ; npm run format ; npm run lint ; npm test ; npm run tu ; npm run test:tu ; npm run test:e2e"

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
alias dkill="docker ps | grep \"\${PWD##*/}\" | awk '{ print \$1 }' | xargs docker kill"
alias drm="docker ps -a | grep \"\${PWD##*/}\" | awk '{ print \$1 }' | xargs docker rm"

alias ks="kubectl"
alias ksc="kubectl config current-context"
alias kse_config="kubectl edit configmap \"\${\${PWD##*/}//-}-config\" -o json"
alias ks_config="kubectl get configmap \"\${\${PWD##*/}//-}-config\" -o json"
alias kse_confy="kubectl edit configmap \"\${\${PWD##*/}//-}-config\" -o yaml"
alias ks_confy="kubectl get configmap \"\${\${PWD##*/}//-}-config\" -o yaml | yh"
alias kse_secret="kubectl edit secrets \"\${\${PWD##*/}//-}-secret\" -o json"
alias ks_secret="kubectl get secrets \"\${\${PWD##*/}//-}-secret\" -o json"
alias kse_secry="kubectl edit secrets \"\${\${PWD##*/}//-}-secret\" -o yaml"
alias ks_secry="kubectl get secrets \"\${\${PWD##*/}//-}-secret\" -o yaml | yh"
alias ks_logs="kubectl logs -lapp=\"\${\${PWD##*/}//-}\" --all-containers=true --since=1h --tail=20"
alias ks_watch="kubectl logs -lapp=\"\${\${PWD##*/}//-}\" --all-containers=true -f"

# DB
alias stop_mongo="kill -2 \$(pgrep mongo)"
alias m="mongod --dbpath=\"\${HOME}/.data/db\""

# Jupyter & Python
alias ju="jupyter"
alias p="pipenv"
alias py="pipenv run python"
# # Exec a Python server that serve the current directory
# PYTHON_CORS_SERVER=<<END
# from SimpleHTTPServer import SimpleHTTPRequestHandler
# import BaseHTTPServer

# class CORSRequestHandler (SimpleHTTPRequestHandler):
#     def end_headers (self):
#         self.send_header('Access-Control-Allow-Origin', '*')
#         SimpleHTTPRequestHandler.end_headers(self)
#         if __name__ == '__main__':
#             BaseHTTPServer.test(CORSRequestHandler, BaseHTTPServer.HTTPServer)
# END
# alias corsserver="echo -e \"${PYTHON_CORS_SERVER}\" | python"

## Program
alias vscode="open -a 'visual studio code'"
alias typora="open -a typora"
alias j="jrnl" # see https://github.com/maebert/jrnl | http://jrnl.sh
alias h="open http://127.0.0.1:8080 & http-server"

# Scripts
alias chenv="~/Documents/work/scripts/telepresence/change_env.sh"
alias deploy_me="~/Documents/work/scripts/telepresence/deploy-me.sh"
alias update_aden="~/Documents/work/scripts/update-aden/index.sh"
alias release="bash ~/Documents/work/scripts/openRelease/index.sh"
alias upade_node="bash ~/Documents/prog/dotfiles/scripts/updateNodeVersion.sh"
alias update_wallpaper="bash ~/Documents/prog/dotfiles/scripts/updateWallpaper.sh"

# Network
alias rp="lsof -nP -iTCP | grep LISTEN" # Running ports
alias local_ip="ipconfig getifaddr en0"
alias distant_ip="curl -s http://checkip.dyndns.org/ | sed 's/[a-zA-Z<>/ :]//g'"
alias ip="echo -e \"Local IP: \$(local_ip); Distant IP: \$(distant_ip)\""
