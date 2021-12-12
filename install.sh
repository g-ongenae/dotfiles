#! /bin/env bash

# Echo in bold format
function bold
{
  echo "$(tput bold)${1}$(tput sgr0)"
}

# Ensure a directory is created
function ensure_dir
{
  local NAME="${1}"
  if ! [ -d "${HOME}/Documents/${NAME}" ] ; then
    mkdir "${HOME}/Documents/${NAME}"
  fi
}

function install_all_tools
{
  xcode --select install 2>/dev/zero

  if [ "$(brew --version 2>/dev/zero)" == "" ] ; then
    bold "Installing Homebrew";
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  else
    bold "Updating Homebrew";
    brew update
  fi

  brew bundle --file "${HOME}/Documents/prog/dotfiles/Brewfile"

  if [ "$(rvm --version 2>/dev/zero)" == "" ]; then
    gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB
    curl -sSL https://get.rvm.io | bash -s stable
  fi

  ! [ -f "/Applications/Perimeter81.app" ] || open https://www.perimeter81.com
}

function install_all_npm
{
  # TODO install vscode & hyper plugins

  bold "Update NPM"
  npm i -g npm

  bold "Install or update globally NPM modules"
  npm i -g pug-lint ember-template-lint eslint tslint prettier sass-lint \
    http-server swagger-editor-live typescript fx unsplash-wallpaper \
    cypress

  npx unsplash-wallpaper --daily # update with a new wallpaper image every day
}

# Create Documents architecture
ensure_dir "prog"
ensure_dir "try"
ensure_dir "write"
ensure_dir "work"

git >/dev/null # install git in silence

# Download dotfiles
if ! [ -d "${HOME}/Documents/prog/dotfiles" ] ; then
  bold "Downloading dotfiles";
  cd "${HOME}/Documents/prog" || { echo "Unable to open prog folder." ; exit ; }
  git clone https://github.com/g-ongenae/dotfiles.git dotfiles
fi

if [ "$(uname)" != "Darwin" ] ; then
  # TODO handle linux
  bold "Unable to install programs: need MacOS"
else
  bold "Starting to install programs"
  install_all_tools
  install_all_npm
fi

# Get current dir (so run this script from anywhere)
DOTFILES_DIR="${HOME}/Documents/prog/dotfiles"
export DOTFILES_DIR

# Bunch of symlinks
bold "Creating Symlinks to access dotfiles from anywhere in user path";
ln -sfv "${DOTFILES_DIR}/git/.gitconfig" ~

# Copying bashrc and zshenv beacause symlinks doesn't work for those
cp "${DOTFILES_DIR}/run/.bash_profile" ~/.bashrc
cp "${DOTFILES_DIR}/run/.zshenv" ~/.zshenv

# Reload
bold "Finished, reset shell session"
exec "${SHELL}" -l
