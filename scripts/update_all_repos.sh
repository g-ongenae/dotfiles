#! /bin/bash

function checkout_base
{
  local BRANCH_NAME="$()"
  if ! [ "${BRANCH_NAME}" == "master" || "${BRANCH_NAME}" == "develop" ] ; then
    # Stash all changes
    git stash -u -m "Automatic stash from ${BRANCH_NAME} to go back to develop"

    # Go back to develop
    git checkout develop

    # Fetch changes
    git pull origin develop
  fi
}

function update_all_repo
{
  for DIR in *; do
    if ! [ -d "${DIR}" ] ; then
      continue
    fi

    if ! [ "${DIR}" == "scripts" || "${DIR}" == "configurations" ] ; then
      checkout_base
    fi


  done
}