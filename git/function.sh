#! /bin/bash

## Git functions
function getCurrentBranch {
	# https://stackoverflow.com/questions/6245570/how-to-get-the-current-branch-name-in-git
	CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
	echo "This is the current branch: $CURRENT_BRANCH"
}

function pull {
	getCurrentBranch
	git pull origin $CURRENT_BRANCH
}

function push {
	getCurrentBranch

	if [ "$#" -gt 0 ]; then
		REMOTE=$1
	else
		REMOTE="origin"
	fi
	read -rp "Are you sure you want to use $REMOTE as remote? Press ^C to exit."

	REMOTE_EXIST=$(git ls-remote --heads $REMOTE $CURRENT_BRANCH | grep -e "$CURRENT_BRANCH" | wc -l)
	if [[ "$REMOTE_EXIST" ]]; then
		git push $REMOTE $CURRENT_BRANCH
	else
		git push --set-upstream $REMOTE $CURRENT_BRANCH
	fi
}

function getBranches {
	BRANCHES=$(git branch) || (>&2 echo "Error while getting branches")

	# Transform the string result into an array
	read -a BRANCHES <<<$BRANCHES

	# Remove character * that indicates the current branch
	for i in "${!BRANCHES[@]}"; do
		if [[ "${BRANCHES[$i]}" = "*" ]]; then
			TO_REMOVE=$i
		fi
	done

	unset "BRANCHES[$TO_REMOVE]"
}

function switch_branch {
	getBranches

	echo "What branch do you want to switch to? "

	select BRANCH in "${BRANCHES[@]}"; do
		git checkout ${BRANCH}

		break;
	done
}

function delete_branch {
	getBranches

	echo "What branch do you want to delete? "

	select BRANCH in "${BRANCHES[@]}" "cancel"; do
		case "$BRANCH" in
			"cancel")
				break;
				;;
			*)
				if [ "$1" == "-f" ]; then
					# Force Delete
					git branch -D ${BRANCH}
				else
					git branch -d ${BRANCH}
				fi
				;;
		esac
	done
}

## Some checks before committing
# TODO: Use git-hooks instead, maybe => http://githooks.com/
# Maybe add a prompt for better commits
function commit {
	[ -f "$CWD/package.json" ] && yarn test
	git commit -m "$1"
}

## TODO:
# function update {
## Update all repositories on computer with git pull
## Two options:
## - Soft: if modifications ignore
## - Hard: Stash and force
# }

function add_my_remote {
	REMOTES=$(git remote -v)
	REGEX="(git@[a-z0-9]+.[a-z]{2,4}):[a-z0-9\-]+\/([a-z0-9\-_]+.git)"
	USERNAME=$(git config --global github.user)

	if [[ $REMOTES =~ $REGEX ]]; then
		REMOTE_URL="${BASH_REMATCH[1]}:$USERNAME/${BASH_REMATCH[2]}"
		# shellcheck disable=SC2086
		git remote add mine $REMOTE_URL
		echo "New remote mine added:"
		git remote -v show mine
	else
		echo "Not remote origin matching."
	fi
}

function fetch_mine_br {
	if [[ $# -eq 0 ]]; then
		echo 'Missing branch argument'
		return
	fi

	git fetch mine $1
	git checkout $1
}
