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

# Run test suite separately
function runTestSuiteSeparately
{
  local ROOT_DIR TEST_DIR TEST_FILE TEST_FILE_EXT RECURSIVE TEST_REGEX

  ROOT_DIR="$(git root)"

  if [ -n "${1}" ] && [ "${1}" = "-R" ] ; then
    RECURSIVE="true"
    shift
  fi

  if [ -n "${1}" ] ; then
    if [ -d "${ROOT_DIR}/${1}" ] ; then
      TEST_DIR="${1}"
    else
      echo "Fatal: Invalid test directory passed: ${1}" >& 1

      return 1
    fi
  elif [ -d "${ROOT_DIR}/test" ] ; then
    TEST_DIR="test"
  elif [ -d "${ROOT_DIR}/tests" ] ; then
    TEST_DIR="tests"
  else
    echo "Fatal: Unknown test directory for ${ROOT_DIR}" >& 1

    return 1
  fi

  TEST_REGEX="\.(e2e(-spec)?|spec)\.ts$"
  TEST_FILES=()
  for FILE in "${ROOT_DIR}/${TEST_DIR}/"* ; do
    if [ -f "$FILE" ] && [[ $FILE =~ $TEST_REGEX ]] ; then
      TEST_FILES+=("$FILE")
    fi
  done

  if [ ${#TEST_FILES[@]} -eq 0 ]; then
    echo "No test files found."

    return 1
  fi

  echo "Available test files:"
  for i in "${!TEST_FILES[@]}"; do
    printf "%2d) %s\n" $((i+1)) "${TEST_FILES[$i]##*/}"
  done
  echo " a) ALL"

  read -p "Select tests to run (comma-separated numbers, or 'a' for all): " SELECTION

  SELECTED_TESTS=()
  if [ "$SELECTION" = "a" ] || [ "$SELECTION" = "A" ]; then
    SELECTED_TESTS=("${TEST_FILES[@]}")
  else
    IFS=',' read -ra INDICES <<< "$SELECTION"
    for idx in "${INDICES[@]}"; do
      idx=$(echo "$idx" | xargs) # trim spaces
      if [[ "$idx" =~ ^[0-9]+$ ]] && [ "$idx" -ge 1 ] && [ "$idx" -le ${#TEST_FILES[@]} ]; then
        SELECTED_TESTS+=("${TEST_FILES[$((idx-1))]}")
      else
        echo "Invalid selection: $idx"
      fi
    done
  fi

  TOTAL_TESTS=${#SELECTED_TESTS[@]}
  if [ $TOTAL_TESTS -eq 0 ]; then
    echo "No valid tests selected. Exiting."
    return 1
  fi

  for ((i=0; i<$TOTAL_TESTS; i++)); do
    TEST_FILE="${SELECTED_TESTS[$i]}"
    CURRENT=$((i+1))
    echo "Running test $CURRENT of $TOTAL_TESTS: ${TEST_FILE##*/}"
    npm run test:e2e -- --detectOpenHandles --forceExit "$TEST_FILE"
    LEFT=$((TOTAL_TESTS-CURRENT))
    if [ $LEFT -gt 0 ]; then
      read -p "Press Enter to continue to the next test ($LEFT left)..."
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
alias ls="eza"
alias la="eza --all --long"
alias cat="bat"

alias _="sudo"
alias q="osascript -e 'tell application \"Terminal\" to quit'"
alias reload="exec \${SHELL} -l"

## Yarn & NPM

# Prettier
alias prettier="npx prettier --write"
alias prettier_markdown="npx prettier --no-config --parser markdown --write"
alias prettier_pkg="npx prettier --no-config --tab-width 1 --write package*.json"
alias prettier_yaml="npx prettier --no-config --parser yaml --write"
alias prettier_json="npx prettier --no-config --parser json --write"
alias prettier_ts="npx prettier --no-config --parser typescript --write"

alias prettier_markdown_git="getGitUpdatedFiles | grep -E '\.(md|markdown)' | xargs prettier_markdown"
alias prettier_yaml_git="getGitUpdatedFiles | grep -E '\.(yml|yaml)' | xargs prettier_yaml"
alias prettier_json_git="getGitUpdatedFiles | grep -v 'package' | grep -E '\.json' | xargs prettier_json"
alias prettier_ts_git="getGitUpdatedFiles | grep -v '.json' | grep -E '\.(js|jsx|ts|tsx)' | xargs prettier_ts"
alias prettier_git="prettier_markdown_git ; prettier_yaml_git ; prettier_json_git ; prettier_ts_git"

alias ordered="getGitUpdatedFiles | grep -v '.json' | grep -E '\.(js|jsx|ts|tsx)' | xargs npx organize-imports-cli"

alias update_config_ts="root ; if [ -f './config/default.json' ] ; then npx node-config-ts ; fi"

# NPM
alias n="npm"
alias nr="npm run"
alias nx="nocorrect npx nx"
  # Run all NPM script to format, lint and build
alias nr_basics="\
  echo 'npx node-config-ts'; update_config_ts ;\
  echo 'npx organize-imports-cli'; ordered ;\
  echo 'npm run prettier'; npm run format --if-present ; npm run prettier --if-present ;\
  echo 'npm run lint'; npm run lint ;\
  echo 'npm run build'; npm run build ;\
"
  # Run all NPM test: e2e, unit, and coverage
alias nr_tests="\
  echo 'npm test'; npm test ;\
  echo 'npm run tu'; npm run tu --if-present ;\
  echo 'npm run test:tu'; npm run test:tu --if-present ;\
  echo 'npm run test:e2e'; npm run test:e2e --if-present ;\
  echo 'npm run test:cov'; npm run test:cov --if-present ;\
  echo 'npm run cover'; npm run cover --if-present ;\
  echo 'open coverage'; open ./coverage/lcov-report/index.html ;\
"
  # Run all NPM script to format, lint and test
alias nr_all="nr_basics ; nr_tests"

alias t="nr_basics ; echo 'npm test'; npm test ; echo 'npm run test:e2e:cov'; runTestSuiteSeparately -R "

  # npm list but listing interesting stuff
function nls
{
  if [ -n "${1}" ] && [ "${1}" = "-g" ] ; then
    # Get all module globally installed (which should be CLI)
    npm list -g --depth=0
  else
    # List scripts of the current project
    ls-scripts
  fi
}

alias y="yarn"
alias sw="swagger-editor-live"

## Haskell
alias hs="ghc"
alias hs_doc="open \${HOME}/Library/Haskell/doc/index.html"

# Ops
alias ci="circleci"
alias d="docker"
alias docker_build_with_secret="docker build --secret id=NPM_TOKEN,env=NPM_TOKEN ."
alias dbuild="docker build -t \"\${PWD##*/}\" \
  --build-arg NODE_ENV=\"production\" \
  --build-arg NPM_TOKEN=\"\$(sed -e 's/\/\/npm.pkg.github.com\/:_authToken=//' ~/.npmrc | head -1)\" \
  --secret id=NPM_TOKEN,env=NPM_TOKEN \
  ."
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

alias upade_node="bash ~/Documents/prog/dotfiles/scripts/updateNodeVersion.sh"
alias update_wallpaper="bash ~/Documents/prog/dotfiles/scripts/update-all-wallpapers.sh"

# Network
alias rp="lsof -nP -iTCP | grep LISTEN" # Running ports
alias local_ip="ipconfig getifaddr en0"
alias distant_ip="curl -s http://checkip.dyndns.org/ | sed 's/[a-zA-Z<>/ :]//g'"
alias ip="echo -e \"Local IP: \$(local_ip); Distant IP: \$(distant_ip)\""

# Some useful scripts
alias update_repos="~/Documents/prog/dotfiles/scripts/update-repos.sh"
alias update_deps="~/Documents/prog/dotfiles/scripts/update-deps.sh"

# Add secret aliases
source ~/Documents/prog/dotfiles/zsh/secret/alias.zsh
