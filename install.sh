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

# function install_yh
# {
#   # Yaml display
#   # https://github.com/andreazorzetto/yh
# }

# Install a cask software
function install_cask
{
  local CASK_NAME="${1}"
  local CASK_INSTALL="${2}"

  if [ "${CASK_INSTALL}" == "" ] ; then
    CASK_INSTALL="${CASK_NAME}"
  fi

  if ! [ -f "/Applications/${CASK_NAME}.app" ] ; then
    brew cask install "${CASK_INSTALL}"
  fi
}

function install_brew
{
  local NAME="${1}"

  if ! [ "$(brew list | grep "${NAME}")" == "" ] ; then
    brew install "${NAME}"
  fi
}

function install_all_tools
{
  # Piping stderr to /dev/zero (2>/dev/zero) to ignore error

  # Check soft deps installed
  xcode-select --install 2>/dev/zero

  if [ "$(brew --version 2>/dev/zero)" == "" ] ; then
    bold "Installing Homebrew";
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  else
    bold "Updating Homebrew";
    brew update
  fi

  bold "Check or install useful softwares";
  # Shell useful command
  install_brew "tree"
  install_brew "gpg"
  install_brew "zoxide"

  # Lang
  ! [ "$(go version 2>/dev/zero)" == "" ] || open https://golang.org/doc/install
  ! [ "$(ghc --version 2>/dev/zero)" == "" ] || open https://www.haskell.org/downloads
  install_brew "node"
  install_brew "nvm"

  if [ "$(rvm --version 2>/dev/zero)" == "" ]; then
    gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB
    curl -sSL https://get.rvm.io | bash -s stable
  fi

  # Journal
  install_brew "jrnl"

  # Git
  install_brew "github/gh/gh"
  install_brew "hub"
  install_brew "git-flow"
  ! [ "$(overcommit --version 2>/dev/zero)" == "" ] || gem install overcommit

  # Ops
  install_brew "mongodb"
  ! [ "$(docker version 2>/dev/zero)" == "" ] || open https://store.docker.com/editions/community/docker-ce-desktop-mac
  install_brew "kubectl"
  install_brew "kube-ps1"

  # Linters / validators
  ! [ "$(circleci version 2>/dev/zero)" == "" ] || curl https://raw.githubusercontent.com/CircleCI-Public/circleci-cli/master/install.sh --fail --show-error | bash
  ! [ "$(travis version 2>/dev/zero)" == "" ] || gem install travis
  install_brew "shellcheck"
  install_brew "hadolint"
  ! [ "$(mdl --version 2>/dev/zero)" == "" ] || gem install mdl
}

function install_all_cask
{
  # Cask installs
  bold "Install Cask"
  install_brew "cask"

  install_cask "insomnia"
  # install_cask "1Clipboard"
  # install_cask "Dashlane"
  install_cask "typora" # or open https://typora.io/download/Typora.dmg
  # install_cask "Studio\ 3T" "studio-3t"
  install_cask "Github\ Desktop" "github-desktop"
  install_cask "Visual\ Studio\ Code" "visual-studio-code"
  install_cask "Google\ Chrome" "google-chrome"
  # ! [ -f "/Applications/Cliqz.app" ] || open https://cdn.cliqz.com/browser-f/download/web0001/CLIQZ.en-US.mac.dmg
  # ! [ -f "/Applications/Perimeter81.app" ] || open https://www.perimeter81.com
  # ! [ -f "/Applications/Scratches.app" ] || open https://github.com/heapwolf/scratches
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

  dum unsplash-wallpaper --daily # update with a new wallpaper image every day
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
  xcode --select install

  bold "Starting to install programs"
  install_all_tools
  install_all_cask
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
