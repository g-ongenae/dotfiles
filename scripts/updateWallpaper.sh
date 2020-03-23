#! /bin/bash

function update
{
  local DIR FILE

  # Create a temporary directory
  DIR="$(mktemp -d)"

  # Download a new wallpaper image
  unsplash-wallpaper --dir "${DIR}" "${OPTION}"

  # Get the filename
  FILE="$(ls "${DIR}")"

  # Set the file as the new wallpaper
  # Source: https://lifehacker.com/set-your-macs-wallpaper-with-a-terminal-command-1728551470
  # NOTE: Works but only to the current desktop (if the terminal is in fullscreen mode, it won't be visible)
  # FIXME: Works for every desktop at once
  osascript -e "tell application \"Finder\" to set desktop picture to POSIX file \"${DIR}/${FILE}\""
}

function main
{
  if [ "$#" -eq "0" ] ; then
    OPTION="--daily" update
  fi

  for OPT in "$@" ; do
    case "$OPT" in
      -d|--daily) OPTION="--daily" update ;;
      -r|--random) OPTION="--random" update ;;
      -h|--help) echo "${USAGE}" ;;
      *)
        echo "Wrong params: ${OPT}"
        echo "${USAGE}"
        ;;
    esac
  done
}

main "$@"
