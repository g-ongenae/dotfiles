#! /bin/sh

# Documentation for git-multi
# https://github.com/tkrajina/git-plus

# --------------------------------------------------------------------------------
# Initial status

# Get status before ignoring some repos
git multi status

# --------------------------------------------------------------------------------
# Update the list of repos to ignore

# -e for except
if [ -n "${1}" ] && [ "${1}" == "-e" ] ; then
  echo "${2}" | sed -e 's/,/\n/g' > .multigit_ignore
fi

# --------------------------------------------------------------------------------
# Switch to the head branch if not already on a stable branch

# Equivalent to git multi head
# But it does not call the distant repos if the current branch
# is already considered stable (main, master, develop or beta)
# This will speed up the process when you have many repos
echo "\
--------------------------------------------------------------------------------
Executing git head
--------------------------------------------------------------------------------
"

for DIR in ./*/ ; do
  if [ -d "${DIR}/.git" ] ; then
    CURRENT_BRANCH=$(git -C "${DIR}" rev-parse --abbrev-ref HEAD)
    # Do not change branch if on main, master, develop or beta branches
    if [ "${CURRENT_BRANCH}" != "main" ] && [ "${CURRENT_BRANCH}" != "master" ] && [ "${CURRENT_BRANCH}" != "develop" ] && [ "${CURRENT_BRANCH}" != "beta" ] ; then
      echo "Changing branch of ${DIR} from branch ${CURRENT_BRANCH}"
      git -C "${DIR}" head
    else
      echo "Skipping ${DIR} on branch ${CURRENT_BRANCH}"
    fi
  fi
done

# --------------------------------------------------------------------------------
# Fetch, pull, prune and show branches

git multi fetch --all
git multi pl
git multi bd
git multi branch

# --------------------------------------------------------------------------------
# Clean up

if [ -f ".multigit_ignore" ] ; then
  rm .multigit_ignore
fi
