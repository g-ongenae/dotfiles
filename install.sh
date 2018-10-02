#! /bin/env bash

# Check soft deps installed
if [ "$(uname)" == "Darwin" ]; then
    ! [ "$(jrnl --version)" == "" ] || brew install jrnl
    ! [ "$(hub --version)" == "" ] || brew install hub
    ! [ "$(git flow version)" == "" ] || brew install git-flow
    ! [ "$(yarn --version)" == "" ] || brew install yarn --without-node
    ! [ "$(kubectl --version)" == "" ] || brew install kubectl
fi

# TODO Add npm package install globally

# Get current dir (so run this script from anywhere)
DOTFILES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DOTFILES_DIR

# Bunch of symlinks
ln -sfv "$DOTFILES_DIR/run/.bash_profile" ~
ln -sfv "$DOTFILES_DIR/git/.gitconfig" ~
