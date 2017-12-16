#!/usr/bin/env bash

# Check soft deps installed
if [ "$(uname)" == "Darwin" ]; then
    ! [ "$(jrnl --version)" == "" ] || brew install jrnl
    ! [ "$(hub --version)" == "" ] || brew install hub
    ! [ "$(git flow version)" == "" ] || brew install git-flow
    ! [ "$(yarn --version)" == "" ] || brew install yarn --without-node
fi

# Get current dir (so run this script from anywhere)
export DOTFILES_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Bunch of symlinks
ln -sfv "$DOTFILES_DIR/run/.bash_profile" ~
ln -sfv "$DOTFILES_DIR/git/.gitconfig" ~
