#! /bin/bash

function get_branches
{
  local BRANCH

  for FOLDER in ./* ; do
    if [ -d "${FOLDER}" ] ; then
      cd "${FOLDER}" || exit 1
      BRANCH="$(git rev-parse --abbrev-ref HEAD)"
      echo " ==> ${FOLDER} is on branch ${BRANCH}"
      # [ "${FOLDER}" == "./aden" ] || || [ "${FOLDER}" == "./configurations" ]
      if [ "${FOLDER}" == "./aggregation-manager" ] ; then
        cd - || exit 1
        continue
      fi
      git pull origin "${BRANCH}"
      # if [ "${BRANCH}" != "master" ] && [ "${BRANCH}" != "develop" ] ; then
      #   echo " ==> ${FOLDER} is on branch ${BRANCH}"
      #   git checkout develop
      #   git branch -d "${BRANCH}"
      # fi
      cd - || exit 1
    fi
  done
}

get_branches
