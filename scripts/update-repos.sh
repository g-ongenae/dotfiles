#! /bin/sh

# Documentation for git-multi
# https://github.com/tkrajina/git-plus

# -e for except
if [ -n "${1}" ] && [ "${1}" == "-e" ] ; then
  echo "${2}" | sed -e 's/,/\n/g' > .multigit_ignore
fi

git multi head
git multi fe --all
git multi pl
git multi bd
git multi b

if [ -f ".multigit_ignore" ] ; then
  rm .multigit_ignore
fi
