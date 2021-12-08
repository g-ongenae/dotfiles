#! /bin/bash

function updateDirectory
{
  cd "${1}" || return

  local BRANCH_NAME BASE_BRANCH_NAME

  # Save current work
  git stash save --include-untracked

  # Checkout one of the default branch
  BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)"
  if [ "${BRANCH_NAME}" == "main" ] || [ "${BRANCH_NAME}" == "master" ] || [ "${BRANCH_NAME}" == "develop" ] ; then
    BASE_BRANCH_NAME="${BRANCH_NAME}"
  else
    BASE_BRANCH_NAME="$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')"
    git switch "${BASE_BRANCH_NAME}"
  fi

  # Pull changes
  git pull origin "${BASE_BRANCH_NAME}"

  # Update node modules
  rm -fr node_modules
  npm install
}

# Loop on directories of the current folder
function loopDir
{
  cd "${1}" || return

  for DIR in ./* ; do
    if [ -d "${DIR}" ] && [ ! "${DIR}" == "go" ] ; then
      updateDirectory "${DIR}"
    fi
  done
}

# Loop on "base" directory to update all directories
function loopBaseDir
{
  local BASE_DIRS

  BASE_DIRS=("${HOME}/Documents/work/" "${HOME}/Documents/prog")
  for BASE_DIR in "${BASE_DIRS[@]}" ; do
    if [ -d "${BASE_DIR}" ] ; then
      loopDir "${BASE_DIR}"
    fi
  done
}