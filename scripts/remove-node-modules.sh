#! /bin/bash

set +e # otherwise the script will exit on error in elementIn function

# Usage
function usage() {
  echo "Usage: $0 [-e] [ignored folders]"
  echo "  -e: except, remove all node modules except for the ignored folders"
  echo "  ignored folders: comma separated list of folders to ignore"
  echo "  example: $0 -e node_modules,build"
  exit 1
}

# Check if an element is in a list
function elementIn() {
  local ELEMENT MATCH="${1}"

  shift

  for ELEMENT ; do
    if [[ "./${ELEMENT}/" == "${MATCH}" ]] ; then
      return 0;
    fi
  done

  return 1
}

# Run
function run() {
  local IGNORED_FOLDERS IFS BASE_PATH FOLDER

  # -e for except
  if [ -n "${1}" ] && [ "${1}" == "-e" ] ; then
    IFS=', ' read -r -a IGNORED_FOLDERS <<< "${2}"
  fi

  if [ -z "${IGNORED_FOLDERS}" ] ; then
    echo "Removing all node modules"
  else
    echo "Removing all node modules except for ${IGNORED_FOLDERS[@]}"
  fi

  for BASE_PATH in '.' './*' ; do
    for FOLDER in ${BASE_PATH}/*/ ; do
      if elementIn "${FOLDER}" "${IGNORED_FOLDERS[@]}" ; then
        echo "Skipping ${FOLDER}"
      elif [[ -d "${FOLDER}/node_modules" ]] ; then
        echo "Removing node modules of ${FOLDER}"
        rm -fr "${FOLDER}/node_modules"
      else
        echo "No node modules in ${FOLDER}, skipping."
      fi
    done
  done

  unset IFS
}

if [ -n "${1}" ] && [ "${1}" != "-e" ] ; then
  usage
fi

run "${@}"

exit 0
