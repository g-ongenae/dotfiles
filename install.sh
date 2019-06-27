#! /bin/env bash

# Echo in bold format
function bold
{
  echo "$(tput bold)${1}$(tput sgr0)"
}

if [ "$(uname)" == "Darwin" ]; then
  # TODO handle linux
  bold "Unable to install programs: need MacOS";

  exit
fi

# Create Documents architecture

mkdir ~/Documents/prog
mkdir ~/Documents/study
mkdir ~/Documents/try
mkdir ~/Documents/write
mkdir ~/Documents/work

# Download dotfiles
if [ ! -d "${HOME}/Documents/prog/dotfiles" ] ; then
  bold "Downloading dotfiles";
  cd ~/Documents/prog || echo "Unable to open prog folder." && exit
  git clone git@github.com:g-ongenae/dotfiles.git dotfiles
fi

# Piping stderr to /dev/zero (2>/dev/zero) to ignore error

# Check soft deps installed
xcode-select --install

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

# Lang
! [ "$(go version 2>/dev/zero)" == "" ] || open https://golang.org/doc/install
! [ "$(brew list | grep nvm)" == "" ] || brew install nvm
# ! [ "$(yarn --version 2>/dev/zero)" == "" ] || brew install yarn --without-node
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
! [ "$(brew info insomnia 2>/dev/zero)" == "" ] || brew cask install insomnia
! [ "$(brew info postman 2>/dev/zero)" == "" ] || brew cask install postman
! [ "$(brew info vectr 2>/dev/zero)" == "" ] || brew cask install vectr
! [ "$(brew info 1Clipboard 2>/dev/zero)" == "" ] || brew cask install 1Clipboard
! [ "$(brew info Dashlane 2>/dev/zero)" == "" ] || brew cask install Dashlane
! [ "$(brew info hyper 2>/dev/zero)" == "" ] || brew cask install hyper
! [ "$(brew info typora 2>/dev/zero)" == "" ] || brew cask install typora
! [ "$(brew info studio-3t 2>/dev/zero)" == "" ] || brew cask install studio-3t
! [ "$(brew info github-desktop 2>/dev/zero)" == "" ] || brew cask install github-desktop
! [ "$(brew info google-chrome 2>/dev/zero)" == "" ] || brew cask install google-chrome
! [ -f "/Applications/Station.app" ] || open https://dl.getstation.com/download/osx
! [ -f "/Applications/Cliqz.app" ] || open https://cdn.cliqz.com/browser-f/download/web0001/CLIQZ.en-US.mac.dmg
! [ "$(brew info visual-studio-code 2>/dev/zero)" == "" ] || brew cask install visual-studio-code

# TODO install vscode & hyper plugins

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
