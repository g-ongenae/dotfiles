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

function prompt_branches {
	echo "Listing branches of the git repository."
	BRANCHES=$(git branch) || echo "Error while getting branches"

	# Transform the string result into an array
	read -a BRANCHES <<<$BRANCHES

	# Remove character * that indicates the current branch
	for i in "${!BRANCHES[@]}"; do
		if [[ "${BRANCHES[$i]}" = "*" ]]; then
			TO_REMOVE=$i
		fi
	done

	unset "BRANCHES[$TO_REMOVE]"

	# Print list of branch with their index
	for i in "${!BRANCHES[@]}"; do
		echo "$i -> ${BRANCHES[i]}"
	done
}

function switch_branch {
	prompt_branches

	read -rp "What branch do you want to switch to? " BRANCH_INDEX

	git checkout ${BRANCHES[$BRANCH_INDEX]}
}

function delete_branch {
	prompt_branches

	read -rp "What branch do you want to delete? " BRANCH_INDEX

	if [ "$#" -gt 0 ] && [ "$1" == "-f" ]; then
		# Force Delete
		git branch -D ${BRANCHES[$BRANCH_INDEX]}
	else
		git branch -d ${BRANCHES[$BRANCH_INDEX]}
	fi
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
	remote=`git remote -v`
	regex="(git@[a-z0-9]+.[a-z]{2,4}):[a-z0-9\-]+/([a-z0-9\-_]+.git)"
	username=`git config --global github.user`

	if [[ $remote =~ $regex ]]; then
		remoteUrl="${BASH_REMATCH[1]}:$username/${BASH_REMATCH[2]}"
		git remote add mine $remoteUrl
		echo "New remote mine added:"
		git remote -v show mine
	else
		echo "Not remote origin matching."
	fi
}