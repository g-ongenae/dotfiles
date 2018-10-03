#! /bin/env bash

# Piping stderr to /dev/null (2>/dev/null) to ignore error

# Check soft deps installed
if [ "$(uname)" == "Darwin" ]; then
  if [ "$(brew --version 2>/dev/null)" == "" ] ; then
    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
  else
    brew update
  fi

  # Lang
  ! [ "$(go version 2>/dev/null)" == "" ] || open https://golang.org/doc/install
  ! [ "$(brew list | grep nvm)" == "" ] || brew install nvm
  ! [ "$(yarn --version 2>/dev/null)" == "" ] || brew install yarn --without-node
  ! [ "$(ghc --version 2>/dev/null)" == "" ] || open https://www.haskell.org/downloads

  if [ "$(rvm --version 2>/dev/null)" == "" ]; then
    gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3 7D2BAF1CF37B13E2069D6956105BD0E739499BDB
    curl -sSL https://get.rvm.io | bash -s stable
  fi

  # Journal
  ! [ "$(jrnl --version 2>/dev/null)" == "" ] || brew install jrnl

  # Git
  ! [ "$(hub --version 2>/dev/null)" == "" ] || brew install hub
  ! [ "$(git flow version 2>/dev/null)" == "" ] || brew install git-flow
  ! [ "$(overcommit --version 2>/dev/null)" == "" ] || gem install overcommit

  # Ops
  ! [ "$(mongod --version 2>/dev/null)" == "" ] || brew install mongodb
  ! [ "$(docker version 2>/dev/null)" == "" ] || open https://store.docker.com/editions/community/docker-ce-desktop-mac
  ! [ "$(kubectl version 2>/dev/null)" == "" ] || brew install kubectl
  ! [ "$(brew list | grep kube-ps1)" == "" ] || brew install kube-ps1

  # Linters / validators
  ! [ "$(circleci version 2>/dev/null)" == "" ] || curl https://raw.githubusercontent.com/CircleCI-Public/circleci-cli/master/install.sh --fail --show-error | bash
  ! [ "$(travis version 2>/dev/null)" == "" ] || gem install travis
  ! [ "$(shellcheck --version 2>/dev/null)" == "" ] || brew install shellcheck
  ! [ "$(hadolint --version 2>/dev/null)" == "" ] || brew install hadolint
  ! [ "$(mdl --version 2>/dev/null)" == "" ] || gem install mdl
  npm i -g pug-lint ember-template-lint eslint tslint prettier sass-lint http-server swagger-editor-live typescript

  # Shell useful command
  ! [ "$(tree --version 2>/dev/null)" == "" ] || brew install tree
fi

# Get current dir (so run this script from anywhere)
DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DOTFILES_DIR

# Bunch of symlinks
ln -sfv "$DOTFILES_DIR/run/.bash_profile" ~
ln -sfv "$DOTFILES_DIR/git/.gitconfig" ~
