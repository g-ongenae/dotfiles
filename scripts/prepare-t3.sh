#!/bin/sh

# Install dependencies
sudo apt-get install git curl libfuse2 build-essential python3

# Install node
curl -o- https://fnm.vercel.app/install | bash
source .bashrc
fnm install 26

# Install Codex and login
npm install -g @openai/codex
codex login --device-auth

# Install gh cli and login
(type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) 	&& sudo mkdir -p -m 755 /etc/apt/keyrings 	&& out=$(mktemp) && wget -nv -O$out https://cli.github.com/packages/githubcli-archive-keyring.gpg 	&& cat $out | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null 	&& sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg 	&& sudo mkdir -p -m 755 /etc/apt/sources.list.d 	&& echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null 	&& sudo apt update 	&& sudo apt install gh -y
gh auth login

# Install T3 Code
LATEST_VERSION=$(gh release list --repo pingdotgg/t3code --jq '<query last version>')
VERSION="${LATEST_VERSION#v*}" # Remove the v at the start of the tag name
gh release download --repo pingdotgg/t3code "${LATEST_VERSION}" -p "T3-Code-${VERSION}-x86_64.AppImage"
chmod +x T3-Code-${VERSION}-x86_64.AppImage

# Install tailscale
curl -fsSL https://tailscale.com/install.sh | sh
