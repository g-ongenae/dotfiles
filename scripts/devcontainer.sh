#!/usr/bin/env bash
set -euo pipefail
action="${1:-}"
workspace="${2:-$PWD}"
if [ ! -d "$workspace" ]; then
  echo "Workspace does not exist: $workspace" >&2
  exit 1
fi
workspace="$(cd -- "$workspace" && pwd)"
case "$action" in
  build|up) devcontainer "$action" --workspace-folder "$workspace" ;;
  shell) devcontainer exec --workspace-folder "$workspace" zsh ;;
  ai) devcontainer exec --workspace-folder "$workspace" claude ;;
  clean)
    # Match this workspace exactly. Never delete unrelated containers/images.
    ids="$(docker ps -aq --filter "label=devcontainer.local_folder=$workspace")"
    while IFS= read -r id; do
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
