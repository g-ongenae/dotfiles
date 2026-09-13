#!/bin/sh

brew update
brew upgrade
brew cleanup

npm update --global

tldr --update

gcloud components update
