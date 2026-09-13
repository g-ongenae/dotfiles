#!/bin/sh

# Echo with colours
# Corrected for MacOS from: https://stackoverflow.com/a/46331700/6086598
# Example: print_colourful @b@green[[Success]]@reset
echo "$@" | sed -E \
  -e "s/((@(red|green|yellow|blue|magenta|cyan|white|reset|b|u))+)\[{2}([^]]+)\]{2}/\1\4@reset/g" \
  -e "s/@red/$(tput setaf 1)/g" \
  -e "s/@green/$(tput setaf 2)/g" \
  -e "s/@yellow/$(tput setaf 3)/g" \
  -e "s/@blue/$(tput setaf 4)/g" \
  -e "s/@magenta/$(tput setaf 5)/g" \
  -e "s/@cyan/$(tput setaf 6)/g" \
  -e "s/@white/$(tput setaf 7)/g" \
  -e "s/@reset/$(tput sgr0)/g" \
  -e "s/@b/$(tput bold)/g" \
  -e "s/@u/$(tput sgr 0 1)/g"
