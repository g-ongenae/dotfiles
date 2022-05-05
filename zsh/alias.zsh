#! /bin/zsh

# Functions

# Get git updated filed
function getGitUpdatedFiles
{
  local DRY STATUS

  DRY="$(git add --all --dry-run | grep -v remove | awk '{print $2}')"
  STATUS="$(git status -s | grep -v D | awk '{print $2}')"

  echo -e "${DRY}\n${STATUS}" | sort | uniq
}

function runTestSuiteSeparately
{
  local ROOT_DIR TEST_DIR TEST_FILE TEST_FILE_EXT

  ROOT_DIR="$(git root)"

  if [ -n "${1}" ] && [ -d "${ROOT_DIR}/${1}" ] ; then
    TEST_DIR="${ROOT_DIR}/${1}"
  elif [ -d "${ROOT_DIR}/test" ] ; then
    TEST_DIR="${ROOT_DIR}/test"
  elif [ -d "${ROOT_DIR}/tests" ] ; then
    TEST_DIR="${ROOT_DIR}/tests"
  else
    echo "Fatal: Unknown test directory for ${ROOT_DIR}" >& 1
  fi

  for TEST_FILE in "${TEST_DIR}/"* ; do
    TEST_FILE_EXT="${TEST_FILE##*.}"
    if [ -f "${TEST_FILE}" ] && [[ "${TEST_FILE_EXT}" == "ts" ]] ; then
      npm run test:e2e -- "${TEST_FILE}"
    fi
  done
}

# Alias

alias c="clear"
alias kill_dashboard="defaults write com.apple.dashboard mcx-disabled -boolean YES; killall Dock"

# Git
alias g="git"
# Go to the root folder of the repository
alias root="cd \"\$(git root || echo .)\""

# Installer
alias b="brew"

## Shell
alias ls="exa"
alias la="exa --all --long"
alias cat="bat"

alias _="sudo"
alias q="osascript -e 'tell application \"Terminal\" to quit'"
alias reload="exec \${SHELL} -l"

## Yarn & NPM
alias fprettier="npx prettier --tab-width 1 --write package*.json"
alias yaml_prettier="\
  getGitUpdatedFiles |\
  grep -E '\.(yml|yaml)' |\
  xargs npx prettier --parser yaml --write\
"
alias json_prettier="
  getGitUpdatedFiles |\
  grep -v 'package' | grep -E '\.json' |\
  xargs npx prettier --parser json --write\
"
alias js_ts_prettier="\
  getGitUpdatedFiles |\
  grep -v '.json' | grep -E '\.(js|jsx|ts|tsx|md)' |\
  xargs npx prettier --write\
"
alias pretty="yaml_prettier ; json_prettier ; js_ts_prettier"
alias ordered="getGitUpdatedFiles | grep -v '.json' | grep -E '\.(js|jsx|ts|tsx)' | xargs npx organize-imports-cli"
alias update_config_ts="root ; if [ -f './config/default.json' ] ; then npx node-config-ts ; fi"
alias n="npm"
alias nr="npm run"
  # Run all NPM script to format, lint and build
alias nr_basics="\
  echo 'npx node-config-ts'; $(update_config_ts) ;\
  echo 'npx organize-imports-cli'; ordered ;\
  echo 'npm run prettier'; pretty ;\
  echo 'npm run lint'; npm run lint ;\
  echo 'npm run build'; npm run build ;\
"
  # Run all NPM test: e2e, unit, and coverage
alias nr_tests="\
  echo 'npm test'; npm test ;\
  echo 'npm run tu'; npm run tu ;\
  echo 'npm run test:tu'; npm run test:tu ;\
  echo 'npm run test:e2e'; npm run test:e2e ;\
  echo 'npm run test:cov'; npm run test:cov ;\
  echo 'npm run cover'; npm run cover ;\
  echo 'open coveragge'; open ./coverage/lcov-report/index.html ;\
"
  # Run all NPM script to format, lint and test
alias nr_all="nr_basics ; nr_tests"

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
alias dstop="docker ps -a | grep \"\${PWD##*/}\" | awk '{ print \$1 }' | xargs docker stop"
alias dkill="docker ps | grep \"\${PWD##*/}\" | awk '{ print \$1 }' | xargs docker kill"
alias drm="docker ps -a | grep \"\${PWD##*/}\" | awk '{ print \$1 }' | xargs docker rm"
alias drmi="d images | grep \"\${PWD##*/}\" | awk '{ print \$3 }' | xargs docker rmi"
alias dclean="d images | grep \"<none>\" | awk '{ print \$3 }' | xargs docker rmi"

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
alias sw_prod="chenv -P algoan-prod -d"
alias sw_preprod="chenv -P algoan-preprod -d"
alias sw_dev="chenv -P algoan-dev -C algoan-dev-v2"

alias deploy_me="~/Documents/work/scripts/telepresence/deploy-me.sh"
alias update_aden="~/Documents/work/scripts/update-aden/index.sh"
alias release="bash ~/Documents/work/scripts/openRelease/index.sh"
alias upade_node="bash ~/Documents/prog/dotfiles/scripts/updateNodeVersion.sh"
alias update_wallpaper="bash ~/Documents/prog/dotfiles/scripts/update-all-wallpapers.sh"

# Network
alias rp="lsof -nP -iTCP | grep LISTEN" # Running ports
alias local_ip="ipconfig getifaddr en0"
alias distant_ip="curl -s http://checkip.dyndns.org/ | sed 's/[a-zA-Z<>/ :]//g'"
alias ip="echo -e \"Local IP: \$(local_ip); Distant IP: \$(distant_ip)\""
