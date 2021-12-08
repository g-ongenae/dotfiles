#! /bin/bash

function update_wallpaper
{
  # Create a temp dir
  local DIR
  local IMAGE

  DIR="$(mktemp -d)"

  # Copy the image of the day
  dum unsplash-wallpaper --random --dir "${DIR}"

  # Get the file name in the temp dir
  IMAGE="$(ls "${DIR}")"

  # Update the wallpaper
  # Reference: https://stackoverflow.com/questions/48778687/change-mac-wallpaper-through-applescript
  # osascript -e "tell application \"System Events\" to set picture of current desktop to \"${DIR}/${IMAGE}\""
  # Refrence: https://stackoverflow.com/questions/18705359/how-to-get-a-list-of-the-desktops-in-applescript
  osascript -e "
    tell application \"System Events\"
      set DESKTOPS to a reference to every desktop
    end tell
    repeat with DESKTOP in DESKTOPS
      set picture of DESKTOP to file \"${DIR}/${IMAGE}\"
    end repeat
  "

  # Delete the image
  rm -fr "${DIR}"
}

update_wallpaper
