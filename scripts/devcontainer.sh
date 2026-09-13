#!/bin/sh

# Devcontainer

cd ~/Documents/work || exit 1

if [[ -z "$1" ]]; then
  echo "Usage: dev <command>"
  echo "Commands:"
  echo "  build - Build the devcontainer"
  echo "  up - Run the devcontainer"
  echo "  shell - Open a shell in the devcontainer"
  echo "  ai - Open a shell in the devcontainer and run claude"
  echo "  clean - Clean the devcontainer"
  return 1
fi

case "$1" in
  build) devcontainer build --workspace-folder . ;;
  up) devcontainer up --workspace-folder . ;;
  shell) devcontainer exec --workspace-folder . zsh ;;
  ai) devcontainer exec --workspace-folder . claude ;;
  clean)
    docker rm -f $(docker ps -a -q | grep 'features' | awk '{print $1}' | head -n 1)
    docker rmi -f $(docker images -a | grep 'features' | awk '{print $2}' | head -n 1)
    ;;
  *)
    echo "Invalid command. Use 'dev build', 'dev up', 'dev shell', 'dev ai', or 'dev clean'."
    return 1
    ;;
esac
