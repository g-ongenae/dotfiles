#! /bin/bash

# shellcheck disable=SC1117

###
# Functions
###

## List dotfiles Help
DOT_HELP="\
Print list of functions and aliases in the dotfiles:

  - ga           git aliases
  - gs           git personal functions
  - a|aliases    aliases
  - f|functions  functions\
";

function dot_help
{
	if [ "$#" == 0 ] ; then
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
			grep --color "^function .*$" "${DOTFILES_DIR}/git/function.sh"
			;;
		a|aliases)
			echo "Aliases:"
			grep --color "alias .*=" "${DOTFILES_DIR}/system/alias.sh"
			grep --color "alias .*=" "${DOTFILES_DIR}/git/alias.sh"
			;;
		f|functions)
			echo "Functions:"
			grep --color "^function .*$" "${DOTFILES_DIR}/system/function.sh"
			;;
		*)
			echo "Error! Unrecognized argument"
			echo -e "${DOT_HELP}"
			;;
	esac
}

## CD functions
# cd .. n-times
# or cd up back from down
function up
{
	if [ "$#" == 0 ] ; then
		if ! [[ "$UP" == "" ]] ; then
			UPS="$UP"
		else
			echo "No up" && return
		fi
	else
		UPS=""
		# shellcheck disable=SC2034
		for i in $(seq 1 "$1") ; do
			UPS="$UPS../"
		done
	fi

	DOWN=$(pwd)
	cd "$UPS" || return

	export DOWN
}

# cd back from up
function down
{
	! [[ "$DOWN" == "" ]] || (echo "No down" && return)
	UP=$(pwd)
	cd "$DOWN" || return

	export UP
}

# Move to a folder and get a recap
function recap
{
	if [ "$#" == 0 ] ; then
		DIR="."
	else
		DIR="$*"
	fi

	cd "$DIR" || return
	echo "$DIR containing:"
	ls -GhF
	echo "$DIR is:"
	[[ -d "$DIR/.git" ]] && git status || echo "Not a repository."
}

## Mkdir
# Move to folder created
function nd
{
	[[ -d "$1" ]] || mkdir "$1" && cd "$1" || return
}

## Move
function trash
{
  mv "$@" ~/.Trash
}

## JSON Output
function json
{
	if [ "$#" == 1 ] ; then
		if [ -f "$1" ] ; then
			fx < "$1"
		else
			# TODO: Check is a valid link
			curl -s "$1" | fx
		fi
	else
		echo "Usage: json <file/url>"
	fi
}

## Journal
function new_day
{
	trap 'echo "" && return' SIGINT
	if [ "$(which jrnl 2>/dev/null)" == "" ] ; then
		echo "Journal is not installed. Run 'brew install jrnl'"
		return
	fi

	if [ "$(jrnl -on today)" == "" ]; then
		echo "What are you working on today?"
		read -rp "Open Journal? (Yes/No) => " ANSWER
		case "$ANSWER" in
			[Yy]*) jrnl ;;
			*) echo "Ok! Have a good day!" ;;
		esac
	fi
}

## Project functions

### Today I learned
function firstLineTilPost
{
	echo "---
layout: post
title: \"$1\"
date: $DATE
categories: main
comments: true
---" > "$NEWFILE"
}

USAGE_TIL=<<END
Usage: Ease TIL gestion.

  - new NAME      initialize a til post
  - open DATE     open til post of a specify date | now
  - cmp MESSAGE   commit and push til modifications
END

function til
{
	if [ "$#" == 0 ] ; then
		cd ~/Documents/prog/til/ || echo "CD failed" && return
		return
	fi

	DATE=$(date +%Y-%m-%d)
	case "$1" in
		new)
			NEWFILE="$HOME/Documents/prog/til/_posts/$DATE-$2.markdown"
			firstLineTilPost "$2"
			vscode "$NEWFILE"
			;;
		open)
			if [ "$2" == "now" ]; then
				vscode "$HOME/Documents/prog/til/_posts/$DATE-*.markdown"
			fi
			;;
		cmp)
			read -rp "Going to commit with message: $2 Press enter to confirm."
			cd ~/Documents/prog/til/ || return
			git commit -am "$2"
			push
			;;
		*) echo -e "${USAGE_TIL}" ;;
	esac
}

### Try
USAGE_TRY=<<END
Usage: Create new project easily.

  - new PROJECTLANG   initialize a project folder
END

function try
{
	if [ "$#" == 0 ] ; then
		cd ~/Documents/try/ || echo "CD failed" && return
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
				npm init
			fi
			;;
		*) echo -e "${USAGE_TRY}" ;;
	esac
}

function day
{
	# Create a new folder for the days in days repo
	# See https://github.com/g-ongenae/days/

	read -rp "What's your today project's name? " NAME

	TODAY=$(date -u +"%m/%d")
	TODAY_DIR="$HOME/Documents/prog/days/src/$TODAY-$NAME"
	# TODO Read folder instead
	if [ "$(date -u +"%d")" -eq "01" ] ; then
		MONTH_FIRST="$HOME/Documents/prog/days/src/$TODAY-$NAME"
		export MONTH_FIRST
	fi
	mkdir -p "$TODAY_DIR"

	cd "$TODAY_DIR" || return
	if [ ! -f "index.html" ] ; then
		if [ -f "$MONTH_FIRST/index.html" ] ; then
			cp "$MONTH_FIRST/index.html" ./
		else
			touch index.html
		fi
	fi
	# [[ -f "style.css" ]] || touch style.css;
	[[ -f "app.js" ]] || touch app.js

	cd "$HOME/Documents/prog/days/src/" || return
	open http://127.0.0.1:8080/ & http-server
}

function ks_list
{
	PODS=$(kubectl get pods) || echo "Error getting list pods" && return
	# Transform string into array
	# shellcheck disable=SC2086
	read -ar PODS <<<$PODS

	echo "Choose a pod in the list by it's number:"
	# Print list of pods with their index
	for i in "${!PODS[@]}" ; do
		echo "$i -> ${PODS[i]}"
	done

	read -rp "What pod do you want to use? " POD_INDEX
	echo "$POD_INDEX" # TODO
}

function ks_exec
{
	# Exec on a specific Kubernetes pod
	echo "Going to exec on a pod..."
	ks_list

	if [[ "$1" -eq "-b" ]]; then
		# Exec bash on POD
		kubectl exec -ti "$POD_NAME" /bin/bash
	else
		if [[ "$#" -eq '2' ]]; then
			kubectl exec "$1" "$POD_NAME" "$2"
		else
			echo "Wrong params. Missing options and command"
		fi
	fi
}

function ks_logs
{
	# Get logs of a specific Kubernetes pod
	echo "Going to log a pod..."
	ks_list

	kubectl logs "$POD_NAME"
}

function ks_up
{
	# Watch Kubernetes pods change through time
	PODS=$(kubectl get pods) || echo "Error getting list pods" && return

	# Change the effect of SIGINT (^C) to exit the infinite loop
	trap 'break' SIGINT
	while true; do
		echo -ne "$PODS\r"
		sleep 1
	done

	# Clean
	trap 'exit' SIGINT
	printf "\n"
}


function lint_file
{
	# TODO: Make a wrapper for all my linters
	# Based on the file extension and name
	if [[ "${FILENAME}" -eq "" ]] ; then
		if [[ "$#" -lt "1" ]] ; then
			echo "Missing filename"
			return
		else
			FILENAME="$1"
		fi
	fi

	case "${FILENAME##*.}" in
		# Code
		js) npx eslint "${FILENAME}" ;;
		ts) npx tslint "${FILENAME}" ;;

		# Ops
		Dockerfile) hadolint "${FILENAME}" ;;

		# Template
		pug) npx pug-lint "${FILENAME}" ;;
		hbs) npx ember-template-lint "${FILENAME}" ;;
		# ejs) ;;

		# Front
		# html) ;;
		# react) ;;

		# - Style
		# css) ;;
		# less) ;;
		sass|scss) sass-lint "${FILENAME}" ;;

		# Data
		# json) ;;
		yaml|yml)
      case "${FILENAME##*/}" in
        "config.yml") circleci config validate "${FILENAME}" ;;
        ".travis.yml") travis lint "${FILENAME}" ;;
        # *) TO ADD YAML Linter ;;
      esac
    ;;

		# Bash
		sh) shellcheck "${FILENAME}" ;;

		# Doc
		md) mdl "${FILENAME}" ;;
	esac

  unset FILENAME
}

function lint_dir
{
	if [[ "$#" -lt "1" ]] ; then
		DIR="$(pwd)"
	else
		DIR="$1"
	fi

	for FILE in $DIR ; do
		lintFile "$FILE"
	done
}

# Echo with colours
# Corrected for MacOS from: https://stackoverflow.com/a/46331700/6086598
# Example: print_colourful @b@green[[Success]]@reset
function print_colourful
{
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
}

# Copy a folder content into a safe place and clean it afterwards
function save_and_clean
{
    local TO_REMOVE="${1}"
    local TO_SAVE="${2}"

    mv "${TO_REMOVE}" "${TO_SAVE}/${TO_REMOVE##*/}"
    mkdir "${TO_REMOVE}"
}

# Save Scratches content & make it work again
function fix_scratches
{
	local SCRATCHES="${HOME}/Library/Application Support/Scratches/Local Storage"

	mv "${SCRATCHES}/file__0.localstorage" "${HOME}/Documents/try/"
	rm "${SCRATCHES}/file__0.localstorage-journal"
}


export -f down nd print_colourful trash up
