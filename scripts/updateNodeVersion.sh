#! /bin/bash

# shellcheck disable=SC2210

# Update all node version of yelloan projects
function updateNodeVersion
{
  local folder="${1}"
  if ! [ -d "${folder}/.git" ]; then
    return
  fi

  cd "${folder}" || return

  print_colourful "@green@b[[Updating ${folder}]]@reset"

  git checkout develop || git checkout master || return
  pull || return
  git checkout -b feature/update-node || return

  # In Dockerfile
  if [ -f "${folder}/Dockerfile" ]; then
    sed -e "s/${LAST_VERSION}/${NEW_VERSION}/g"
  fi

  # In package.json
  if [ -f "${folder}/package.json" ]; then
    sed -e "s/${LAST_VERSION}/${NEW_VERSION}/"
  fi

  git commit -am "Update node version to ${NEW_VERSION}"
  push

  cd - 2&>1 || return
}

# Main

if ! [ "$#" -eq 3 ]; then
  echo "Missing Parameters"
  exit 1
fi

DIR="${1}"
LAST_VERSION="${2}"
NEW_VERSION="${3}"

# Start from a folder
cd "${DIR}" || exit

# Update each folder here
for i in ./*; do
  if [ -d "${i}" ]; then
    updateNodeVersion "${i}"
  fi
done
