# Functions

## List dotfiles Help
function dot_help {
	# TODO make it a little bit pretty, just a little...
	DOT_HELP="Print list of functions and aliases in the dotfiles:\n"
	DOT_HELP="$DOT_HELP	ga - git aliases\n"
	DOT_HELP="$DOT_HELP	gs - git personal functions\n"
	DOT_HELP="$DOT_HELP	a|aliases - aliases\n"
	DOT_HELP="$DOT_HELP	f|functions - functions"

	if [ "$#" == 0 ]; then
		echo -e "$DOT_HELP"
		return
	fi

	case "$1" in
		ga)
			echo "Git aliases:"
			git config --list | grep --color "alias.*="
			;;
		gf)
			echo "Git personal functions:"
			grep --color "function .*{" $DOTFILES_DIR/git/.function
			;;
		a|aliases)
			echo "Aliases:"
			grep --color "alias .*=" $DOTFILES_DIR/system/.alias
			grep --color "alias .*=" $DOTFILES_DIR/git/.alias
			;;
		f|functions)
			echo "Functions:"
			grep --color "function .*{" $DOTFILES_DIR/system/.function
			;;
		*)
			echo "Error! Unrecognized argument"
			echo -e "$DOT_HELP"
			;;
	esac
}

## Open
function atom {
	if [ "$#" == 0 ]; then
		open -a atom .
	else
		open -a atom "$1"
	fi
}

## CD functions
# cd .. n-times 
# or cd up back from down
function up {
	if [ "$#" == 0 ]; then
		! [[ "$UP" == "" ]] && UPS=$UP || (echo "No up" && return)
	else
		UPS=""
		for i in $(seq 1 $1); do
			UPS=$UPS"../"
		done
	fi

	DOWN=`pwd`
	cd $UPS || return
}

# cd back from up
function down {
	! [[ "$DOWN" == "" ]] || (echo "No down" && return)
	UP=`pwd`
	cd $DOWN || return
}

# Move to a folder and get a recap
function recap {
	if [ "$#" == 0 ]; then
		DIR="."
	else
		DIR="$@"
	fi

	cd "$DIR" || return
	echo $DIR " containing:"
	ls -GhF
	echo "$DIR" " is:"
	[[ -d "$DIR/.git" ]] && git status || echo "Not a repository."
}

## Mkdir
# Move to folder created
function nd {
	[[ -d "$1" ]] || mkdir "$1" && cd "$1" || return
}

## Move
function trash { mv "$@" ~/.Trash; }

## JSON Output
function json {
	if [ "$#" == 1 ]; then
		if [ -f "$1" ]; then
			cat $1 | python -m json.tool
		else
			# TODO: Check is a valid link
			curl -s "$1" | python -m json.tool
		fi
	else
		echo "Usage: json <file/url>"
	fi
}

## Journal
function new_day {
	trap 'echo "" && return' SIGINT
	if [ "$(jrnl -v)" == "" ]; then
		echo "Journal is not installed. Run `brew install jrnl`"
		return
	fi

	if [ "$(jrnl -on today)" == "" ]; then
		echo "What are you working on today?"
		read -p "Open Journal? (Yes/No) => " answer
		case "$answer" in
			[Yy]* )
				jrnl
				;;
			*)
				echo "Ok! Have a good day!"
				;;
		esac
	fi
}

## Project functions

### Today I learned
function firstLineTilPost {
	echo "---
layout: post
title: \"$1\"
date: $DATE
categories: main
comments: true
---" > "$NEWFILE"
}

function til {
	if [ "$#" == 0 ]; then
		cd ~/Documents/code/til/
		return
	fi

	DATE=$(date +%Y-%m-%d)
	case "$1" in
		new)
			NEWFILE="$HOME/Documents/code/til/_posts/$DATE-$2.markdown"
			firstLineTilPost "$2"
			atom "$NEWFILE"
			;;
		open)
			if [ "$2" == "now" ]; then
				atom "$HOME/Documents/code/til/_posts/$DATE-*.markdown"
			fi
			;;
		cmp)
			read -rp "Going to commit with message: $2 Press enter to confirm."
			cd ~/Documents/code/til/ || return
			git commit -am "$2"
			push
			;;
		*)
			echo "Usage: Ease TIL gestion."
			echo "new NAME initialize a til post"
			echo "open DATE open til post of a specify date | now"
			echo "cmp MESSAGE commit and push til modifications"
			;;
	esac
}

### Try
function try {
	if [ "$#" == 0 ]; then
		cd ~/Documents/try/
		return
	fi

	case "$1" in
		new)
			echo "What's your project's name? "
			read -r NAME
			FOLDER="$HOME/Documents/try/$NAME"
			mkdir "$FOLDER"
			cd "$FOLDER" || return
			echo "$FOLDER created."
			if [ "$2" == "node" ]; then
				yarn init
			fi
			;;
		*)
			echo "Usage: Create new project easily."
			echo "new PROJECTLANG initialize a project folder"
			;;
	esac
}

## GitHub
function github {
	if [ "$#" == 0 ]; then
		cd ~/Documents/code/github
		return
	fi

	case "$1" in
		io)
			cd ~/Documents/code/g-ongenae.github.io
			atom .
			;;
		d|desktop)
			# Use git d instead
			open -a 'github desktop'
			;;
		w|web)
			open https://github.com/
			;;
		h|help)
			echo "		- Open github folder"
			echo "io	- Open g-ongenae.github.io folder"
			echo "w		- Open Github in the browser"
			;;
	esac
}