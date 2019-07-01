#! /bin/env bash

# Echo in bold format
function bold
{
  echo "$(tput bold)${1}$(tput sgr0)"
}

if [ "$(uname)" != "Darwin" ]; then
  # TODO handle linux
  bold "Unable to install programs: need MacOS";

  exit
fi

# Create Documents architecture

! [ -f "${HOME}/Documents/prog" ] || mkdir ~/Documents/prog
! [ -f "${HOME}/Documents/study" ] || mkdir ~/Documents/study
! [ -f "${HOME}/Documents/try" ] || mkdir ~/Documents/try
! [ -f "${HOME}/Documents/write" ] || mkdir ~/Documents/write
! [ -f "${HOME}/Documents/work" ] || mkdir ~/Documents/work

# Download dotfiles
if [ ! -d "${HOME}/Documents/prog/dotfiles" ] ; then
  bold "Downloading dotfiles";
  cd ~/Documents/prog || echo "Unable to open prog folder." && exit
  git clone git@github.com:g-ongenae/dotfiles.git dotfiles
fi

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
! [ "$(tree --version 2>/dev/zero)" == "" ] || brew install tree
! [ "$(gpg --version 2>/dev/zero)" == "" ] || brew install gpg

# Lang
! [ "$(go version 2>/dev/zero)" == "" ] || open https://golang.org/doc/install
! [ "$(brew list | grep nvm)" == "" ] || brew install nvm
! [ "$(ghc --version 2>/dev/zero)" == "" ] || open https://www.haskell.org/downloads

if [ "$(rvm --version 2>/dev/zero)" == "" ]; then
  gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB
  curl -sSL https://get.rvm.io | bash -s stable
fi

# Journal
! [ "$(jrnl --version 2>/dev/zero)" == "" ] || brew install jrnl

# Git
! [ "$(hub --version 2>/dev/zero)" == "" ] || brew install hub
! [ "$(git flow version 2>/dev/zero)" == "" ] || brew install git-flow
! [ "$(overcommit --version 2>/dev/zero)" == "" ] || gem install overcommit

# Ops
! [ "$(mongod --version 2>/dev/zero)" == "" ] || brew install mongodb
! [ "$(docker version 2>/dev/zero)" == "" ] || open https://store.docker.com/editions/community/docker-ce-desktop-mac
! [ "$(kubectl version 2>/dev/zero)" == "" ] || brew install kubectl
! [ "$(brew list | grep kube-ps1)" == "" ] || brew install kube-ps1

# Linters / validators
! [ "$(circleci version 2>/dev/zero)" == "" ] || curl https://raw.githubusercontent.com/CircleCI-Public/circleci-cli/master/install.sh --fail --show-error | bash
! [ "$(travis version 2>/dev/zero)" == "" ] || gem install travis
! [ "$(shellcheck --version 2>/dev/zero)" == "" ] || brew install shellcheck
! [ "$(hadolint --version 2>/dev/zero)" == "" ] || brew install hadolint
! [ "$(mdl --version 2>/dev/zero)" == "" ] || gem install mdl

# Cask installs
! [ -f "/Applications/Insomnia.app" ] || brew cask install insomnia
! [ -f "/Applications/Postman.app" ] || brew cask install postman
! [ -f "/Applications/Vectr.app" ] || brew cask install vectr
! [ -f "/Applications/1Clipboard.app" ] || brew cask install 1Clipboard
! [ -f "/Applications/Dashlane.app" ] || brew cask install Dashlane
! [ -f "/Applications/Hyper.app" ] || brew cask install hyper
! [ -f "/Applications/Typora.app" ] || brew cask install typora
! [ -f "/Applications/Studio\ 3T.app" ] || brew cask install studio-3t
! [ -f "/Applications/GitHub\ Desktop.app" ] || brew cask install github-desktop
! [ -f "/Applications/Google\ Chrome.app" ] || brew cask install google-chrome
! [ -f "/Applications/Station.app" ] || open https://dl.getstation.com/download/osx
! [ -f "/Applications/Cliqz.app" ] || open https://cdn.cliqz.com/browser-f/download/web0001/CLIQZ.en-US.mac.dmg
! [ -f "/Applications/Visual\ Studio\ Code.app" ] || brew cask install visual-studio-code

# TODO install vscode & hyper plugins

bold "Update NPM"
npm i -g npm

bold "Install or update globally NPM modules"
npm i -g pug-lint ember-template-lint eslint tslint prettier sass-lint \
  http-server swagger-editor-live typescript fx

# Get current dir (so run this script from anywhere)
DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DOTFILES_DIR

# Bunch of symlinks
bold "Creating Symlinks to access dotfiles from anywhere in user path";
ln -sfv "$DOTFILES_DIR/run/.bash_profile" ~
ln -sfv "$DOTFILES_DIR/git/.gitconfig" ~

# Reload
bold "Finished, reset shell session"
exec "${SHELL}" -l
