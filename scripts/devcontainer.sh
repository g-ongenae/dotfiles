#!/usr/bin/env bash
# Thin wrapper around the Dev Container CLI, exposed as `dev` on macOS.
#
#   dev {build|up|shell|ai|clean} [workspace-directory]
#
# The workspace defaults to the current directory.

set -euo pipefail

action="${1:-}"
workspace="${2:-$PWD}"

if [ ! -d "$workspace" ]; then
  echo "Workspace does not exist: $workspace" >&2
  exit 1
fi

# Resolve to an absolute path: `clean` matches containers on it literally.
workspace="$(cd -- "$workspace" && pwd)"

case "$action" in

  build | up) devcontainer "$action" --workspace-folder "$workspace" ;;
  shell) devcontainer exec --workspace-folder "$workspace" zsh ;;
  ai) devcontainer exec --workspace-folder "$workspace" claude ;;

  clean)
    # Match this workspace exactly. Never delete unrelated containers/images.
    ids="$(docker ps -aq --filter "label=devcontainer.local_folder=$workspace")"
    while IFS= read -r id; do
      # A workspace with no containers yields one empty line.
      if [ -n "$id" ]; then
        docker rm -f "$id"
      fi
    done <<< "$ids"
    ;;

  *)
    echo "Usage: dev {build|up|shell|ai|clean} [workspace-directory]" >&2
    exit 1
    ;;

esac
