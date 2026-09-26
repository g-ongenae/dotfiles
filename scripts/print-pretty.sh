#!/bin/sh
# Echo with colours.
#
# Markup is `@<style>[[text]]`, where styles may be combined:
#
#   print-pretty.sh '@b@green[[Success]]'
#   print-pretty.sh '@red[[Failed]] and @u[[underlined]]'
#
# The first expression turns `@style[[text]]` into `@style` + text + `@reset`,
# so every styled run closes itself. The remaining ones replace each `@name`
# with the terminal escape sequence `tput` reports for it.
#
# Corrected for MacOS from: https://stackoverflow.com/a/46331700/6086598

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
