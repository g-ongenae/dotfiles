#!/bin/sh

function randomize_files()
{
  local DIR FILES RANDOMIZED_FILES INDEX FILE EXTENSION

  DIR="$1"

  echo "Randomizing files in directory: $DIR"
  cd "$DIR" || { echo "Failed to change directory to $DIR"; return 1; }

  FILES="$(ls)"
  echo "Found $(( $(echo "$FILES" | wc -l) )) files"

  RANDOMIZED_FILES="$(echo "$FILES" | shuf)"

  INDEX=1
  for FILE in $RANDOMIZED_FILES; do
    EXTENSION="${FILE##*.}"
    echo "Processing $FILE -> $INDEX.$EXTENSION"
    mv "$FILE" "$INDEX.$EXTENSION"
    INDEX=$((INDEX + 1))
  done
}

randomize_files "$1"
