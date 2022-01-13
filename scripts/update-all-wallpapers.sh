#! /bin/bash

# Note: This script requires two dependencies
# - macos-wallpaper, which you can install with brew by running: `brew install wallpaper`
# - unsplash-wallpaper, which you can install with npm by running: `npm install --global unsplash-wallpaper`

# Maybe you want the wallpapers to be updated each day
# If so, you can create a cronjob by running: `crontab -e`
# And adding a new line with the following command:
# `0 0 * * * bash ${HOME}/Documents/prog/dotfiles/scripts/update-all-wallpapers.sh`

# Update the wallpaper on every screen available
# With a random one from unsplash
function update_all_wallpapers
{
  # Create a temp dir
  local DIR
  local IMAGE

  # Create a temporary directory
  DIR="$(mktemp -d)"

  # Copy the image to the temporary folder
  npx unsplash-wallpaper --random --dir "${DIR}"

  # Get the file name in the temp dir
  IMAGE="$(ls "${DIR}")"

  # Set the new wallpaper on all available screens
  wallpaper set "${DIR}/${IMAGE}" --screen all

  # Delete the image
  rm -fr "${DIR}"
}

update_all_wallpapers
