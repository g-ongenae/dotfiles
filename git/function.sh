#! /bin/bash

# shellcheck disable=SC1117,SC2086,SC2162,SC2210,SC2155

CANCEL="cancel"

## Git functions

function choose_remote
{
  local REMOTES=$(git remote)

  echo "What is the remote you want to use?"

	select CHOICE in $REMOTES "$CANCEL" ; do
		REMOTE="$CHOICE"
		return
	done
}

function get_current_branch
{
	# https://stackoverflow.com/questions/6245570/how-to-get-the-current-branch-name-in-git
	CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
	echo "This is the current branch: $CURRENT_BRANCH"
}

function pull
{
	get_current_branch

	if [ "$#" -gt 0 ] && ! [[ ${1} =~ ^- ]] ; then
		REMOTE="$1"
	else
		choose_remote
	fi

  if [ "${REMOTE}" == "${CANCEL}" ] ; then
    return;
  fi

	git pull "$REMOTE" "$CURRENT_BRANCH"
}

function push
{
	get_current_branch

	if [ "$#" -gt 0 ] && ! [[ ${1} =~ ^- ]] ; then
		REMOTE="$1"
	else
    choose_remote
	fi

  REMOTE_URL=$(git remote get-url "${REMOTE}")
	read -rp "Are you sure you want to use ${REMOTE_URL} as remote? Press ^C to exit."

	if [ "$#" -eq 2 ] ; then
		OPTIONS="$2"
		read -rp "Are you sure you want to use this option: $OPTIONS? Press ^C to exit."
	fi

	REMOTE_EXIST=$(git ls-remote --heads "$REMOTE" "$CURRENT_BRANCH" | grep -c -e "$CURRENT_BRANCH")
	if [[ "$REMOTE_EXIST" ]] ; then
		OPTIONS="$OPTIONS --set-upstream"
	fi

	git push $OPTIONS "$REMOTE" "$CURRENT_BRANCH"
}

function get_branches
{
	BRANCHES=$(git branch) || (>&2 echo "Error while getting branches")

	# Transform the string result into an array
	read -a BRANCHES <<<$BRANCHES

	# Remove character * that indicates the current branch
	for i in "${!BRANCHES[@]}" ; do
		if [[ "${BRANCHES[$i]}" = "*" ]] ; then
			TO_REMOVE="${i}"

      break
		fi
	done

	unset "BRANCHES[$TO_REMOVE]"
}

function switch_branch
{
	get_branches

	echo "What branch do you want to switch to? "

	select BRANCH in "${BRANCHES[@]}" "$CANCEL" ; do
		if [ "$BRANCH" != "$CANCEL" ] ; then
			git checkout "${BRANCH}"
		fi

		break
	done
}

function delete_branch
{
	get_branches

	echo "What branch do you want to delete? "

	select BRANCH in "${BRANCHES[@]}" "$CANCEL" ; do
		case "$BRANCH" in
			"$CANCEL") break ;;
			*)
				if [ "$1" == "-f" ] ; then
					# Force Delete
					git branch -D "${BRANCH}"
				else
					git branch -d "${BRANCH}"
				fi
				;;
		esac
	done
}

## TODO:
# function update
# {
## Update all repositories on computer with git pull
## Two options:
## - Soft: if modifications ignore
## - Hard: Stash and force
# }

function add_my_remote
{
	REMOTES=$(git remote -v)
	REGEX="(git@[a-z0-9]+.[a-z]{2,4}):[a-z0-9\-]+\/([a-z0-9\-_]+.git)"
	USERNAME=$(git config --global github.user)

	if [[ $REMOTES =~ $REGEX ]]; then
		REMOTE_URL="${BASH_REMATCH[1]}:$USERNAME/${BASH_REMATCH[2]}"
		# shellcheck disable=SC2086
		git remote add mine "$REMOTE_URL"
		echo "New remote mine added:"
		git remote -v show mine
	else
		echo "Not remote origin matching."
	fi
}

function choose_remote_branch
{
	REMOTES_BRANCHES=$(git ls-remote -q --heads "$1" | sed -nE 's/^.{30,}refs\/heads\/(.+)$/\1/p')

	echo "What is the name of the branch you want to clone?"

	select CHOICE in $REMOTES_BRANCHES "$CANCEL" ; do
		FETCHING_BRANCH="$CHOICE"
		return
	done
}

function fetch_br
{
  if [[ "$#" -eq "0" ]] || [[ "${2}" -eq "" ]] ; then
    choose_remote
  else
    REMOTE="${2}"
  fi

	if [[ "$#" -eq "0" ]] || [[ "${1}" -eq "" ]] ; then
		choose_remote_branch "${REMOTE}"
		if [[ "$CHOICE" == "$CANCEL" ]]; then return ; fi
	else
		FETCHING_BRANCH="${1}"
	fi

	git fetch "${REMOTE}" "${FETCHING_BRANCH}"
	git checkout "${FETCHING_BRANCH}"
}

USAGE_BR="\
Usage: br -[d|f|s|l]

                      => git branch
  -s 			            => switch branch easily
  -d [-f] 	          => delete branches easily [option to force]
  -f [name] [remote]  => fetch branch from 'mine' remote
  -l [remote]         => list branches from 'origin' remote
";

function br
{
	if [ "$#" -eq "0" ]; then
		git branch
		return;
	fi

	case "$1" in
		-s|s) switch_branch ;;
		-d|d) delete_branch "$2" ;;
		-f|f) fetch_br "$2" "$3" ;;
		-l|l)
			if [ "$#" -eq "1" ] ; then
				choose_remote_branch origin
			else
				choose_remote_branch "$2"
			fi
			;;
		-h|h) echo "${USAGE_BR}" ;;
		*)
			print_colourful "\
@b@red[[Unknown options: $1]]@reset
@b@green[[See help with -h]]@reset\
      ";
			;;
	esac
}

function update_repository
{
  cd "${1}" || return
  local folder
  folder="$(pwd)"

  if ! [ -d "${folder}/.git" ] ; then
    echo "${folder}.git"
    print_colourful "@blue[[Ignoring ${folder}: not a repository]]@reset"
    cd - 2&>1 || return
    return
  fi

  print_colourful "@green@b[[Updating repository ${folder}]]@reset"
  get_branches

  for b in "${BRANCHES[@]}" ; do
    if git diff-index --quiet HEAD -- ; then
      print_colourful "@green[[Pulling branch ${b} changes]]@reset"
      git pull
    else
      print_colourful "@red[[Uncommitted changes on branch ${b}]]@reset"
    fi
  done

  cd - 2&>1 || return
}

function update_all_repositories
{
  cd "${1}" || return

  # Update each folder here
  for i in ./* ; do
    if [ -d "${i}" ] ; then
      update_repository "${i}"
    fi
  done
}

# Push the current branch and open a Pull Request
function push_and_open_pr
{
  local BRANCH_NAME
  local REVIEWERS
  local REVIEWER_LIST

  # Get informations
  BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)"
  REVIEWERS="$(git log --pretty="%ae" | grep "algoan" | sort -u)"
  read -r -a REVIEWER_LIST <<< "${REVIEWERS}"

  if [ "${BRANCH_NAME%/*}" == "hotfix" ] ; then
    echo "Do not use this script to open an hotfix." >&2

    exit 1
  fi

  # Push branch
  git push -u ${1:origin} "${BRANCH_NAME}"

  # Open PR
  gh pr create \
    --base "develop" \
    --repo "${${$(git remote get-url origin)##*:}%.*}" \
    --reviewer "${REVIEWER_LIST[0]}" --reviewer "${REVIEWER_LIST[1]}" --reviewer "${REVIEWER_LIST[2]}" \
    --title "${BRANCH_NAME##*/}" \
		--draft # Set as draft until the test passes
}

export -f add_my_remote br get_branches get_current_branch pull push push_and_open_pr
