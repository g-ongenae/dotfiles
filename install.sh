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

# Install basic tools
function install_basic_tools
{
  # Install XCode
  xcode-select --install

  read -r -p "Press enter to continue"

  # Install Git
  git

  read -r -p "Press enter to continue"

  # Download dotfiles
  if ! [ -d "${HOME}/Documents/prog/dotfiles" ] ; then
    bold "Downloading dotfiles";
    # Clone repository
    cd "${HOME}/Documents/prog" || { echo "Unable to open prog folder." ; exit 1 ; }
    git clone https://github.com/g-ongenae/dotfiles.git dotfiles

    # Add Submodules
    cd "${HOME}/Documents/prog/dotfiles" || exit 1
    git submodule init
    git submodule update
  fi
}

# Install Homebrew
function install_homebrew
{
  if [ "$(brew --version 2>/dev/zero)" == "" ] ; then
    bold "Installing Homebrew";
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  else
    bold "Updating Homebrew";
    brew update
  fi

  # Install Brew dependenciesw
  brew bundle
}

# Install NPM global modules
function install_npm_modules
{
  bold "Update NPM"
  npm i -g npm

  bold "Install or update globally NPM modules"
  cat ./NPMGlobalModules.txt | xargs npm i -g

  npx unsplash-wallpaper --daily # update with a new wallpaper image every day
}

# Install VS Code plugins
function install_vscode_plugins
{
  bold "Install VSCode plugins"
  while read -r CODE_EXTENSION ; do
    code --install-extension "${CODE_EXTENSION}"
  done < ./VSCodeExtension.txt
}

function install_specials
{
  # Install RVM
  if [ "$(rvm --version 2>/dev/zero)" == "" ] ; then
    gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB
    curl -sSL https://get.rvm.io | bash -s stable
  fi

  # Install Oh My ZSH
  sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

  # Install Perimeter81 manually
  if ! [ -f "/Applications/Perimeter81.app" ] ; then
    open https://www.perimeter81.com
  fi
}

# Create Documents architecture
ensure_dir "prog"
ensure_dir "try"
ensure_dir "write"
ensure_dir "work"

if [ "$(uname)" != "Darwin" ] ; then
  # TODO handle linux
  bold "Unable to install programs: need MacOS"
else
  bold "Starting to install programs"
  install_basic_tools

  cd "${HOME}/Documents/prog/dotfiles" || exit 1

  install_homebrew
  install_npm_modules
  install_vscode_plugins
  install_specials
fi

# Get current dir (so run this script from anywhere)
DOTFILES_DIR="${HOME}/Documents/prog/dotfiles"
export DOTFILES_DIR

# Bunch of symlinks
bold "Creating Symlinks to access dotfiles from anywhere in user path";
ln -sfv "${DOTFILES_DIR}/git/.gitconfig" ~

# Copying bashrc and zshenv beacause symlinks doesn't work for those
cp "${DOTFILES_DIR}/run/bash_profile.template.bash" ~/.bashrc
cp "${DOTFILES_DIR}/run/bash_profile.template.bash" ~/.bash_profile
cp "${DOTFILES_DIR}/run/zshenv.template.zsh" ~/.zshenv
cp "${DOTFILES_DIR}/apps/finicky.template.js" ~/.finicky.js

# Add a link to easily access the running copies
ln -sfv ~/.bashrc "${DOTFILES_DIR}/run/bashrc.link.bash"
ln -sfv ~/.bash_profile "${DOTFILES_DIR}/run/bash_profile.link.bash"
ln -sfv ~/.zshenv "${DOTFILES_DIR}/run/zshenv.link.zsh"
ln -sfv ~/.finicky.js "${DOTFILES_DIR}/apps/finicky.link.js"

# Reload
bold "Finished, reset shell session"
exec "${SHELL}" -l
