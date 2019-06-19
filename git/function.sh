#! /bin/bash

# shellcheck disable=SC1117,SC2086,SC2162

## Git functions
function get_current_branch
{
	# https://stackoverflow.com/questions/6245570/how-to-get-the-current-branch-name-in-git
	CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
	echo "This is the current branch: $CURRENT_BRANCH"
}

function pull
{
	get_current_branch

	if [ "$#" -gt 0 ]; then
		REMOTE="$1"
	else
		REMOTE="origin"
	fi

	git pull "$REMOTE" "$CURRENT_BRANCH"
}

function push
{
	get_current_branch

	if [ "$#" -gt 0 ]; then
		REMOTE="$1"
	else
		REMOTE="origin"
	fi
	REMOTE_URL=$(git remote get-url "${REMOTE}")
	read -rp "Are you sure you want to use ${REMOTE_URL} as remote? Press ^C to exit."

	if [ "$#" -eq 2 ]; then
		OPTIONS="$2"
		read -rp "Are you sure you want to use this option: $OPTIONS? Press ^C to exit."
	fi

	REMOTE_EXIST=$(git ls-remote --heads $REMOTE $CURRENT_BRANCH | grep -c -e "$CURRENT_BRANCH")
	if [[ "$REMOTE_EXIST" ]]; then
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
	for i in "${!BRANCHES[@]}"; do
		if [[ "${BRANCHES[$i]}" = "*" ]]; then
			TO_REMOVE=$i
		fi
	done

	unset "BRANCHES[$TO_REMOVE]"
}

function switch_branch
{
	get_branches

	echo "What branch do you want to switch to? "

	CANCEL="cancel"
	select BRANCH in "${BRANCHES[@]}" "$CANCEL"; do
		if [ "$BRANCH" != "$CANCEL" ]; then
			git checkout "${BRANCH}"
		fi

		break;
	done
}

function delete_branch
{
	get_branches

	echo "What branch do you want to delete? "

	CANCEL="cancel"
	select BRANCH in "${BRANCHES[@]}" "$CANCEL"; do
		case "$BRANCH" in
			"$CANCEL")
				break;
				;;
			*)
				if [ "$1" == "-f" ]; then
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
# function update {
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
	REMOTES_BRANCHES=$(git ls-remote -q --heads $1 | sed -nE 's/^.{30,}refs\/heads\/(.+)$/\1/p')

	echo "What is the name of the branch you want to clone?"

	CANCEL="cancel"
	select CHOICE in $REMOTES_BRANCHES "$CANCEL"; do
		FETCHING_BRANCH="$CHOICE"
		return
	done
}

function fetch_mine_br
{
	if [[ "$#" -eq "0" ]] || [[ "$1" -eq "" ]]; then
		choose_remote_branch "mine"
		if [[ "$CHOICE" == "$CANCEL" ]]; then
			return
		fi
	else
		FETCHING_BRANCH="$1"
	fi

	git fetch mine "${FETCHING_BRANCH}"
	git checkout "${FETCHING_BRANCH}"
}

USAGE_BR=<<END
  Usage: br -[d|f|s]

            => git branch
  -s 			  => switch branch easily
  -d [-f] 	=> delete branches easily [option to force]
  -f [name]	=> fetch branch from 'mine' remote
END

function br
{
	if [ "$#" -eq "0" ]; then
		git branch
		return;
	fi

	case "$1" in
		-s|s)
			switch_branch
			;;
		-d|d)
			delete_branch "$2"
			;;
		-f|f)
			fetch_mine_br "$2"
			;;
    -h|h)
      echo -e "${USAGE_BR}";
      ;;
		*)
			printf "Unknown options: %s\n%s" "$1" "${USAGE_BR}";
			;;
	esac
}
