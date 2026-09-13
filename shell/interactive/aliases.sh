# Sourced only at a prompt, never into build/SSH command environments.
alias g='git'
alias c='clear'
alias _='sudo'
alias reload='exec "${SHELL:-/bin/bash}" -l'
alias n='npm'
alias nr='npm run'
command -v eza >/dev/null 2>&1 && alias ls='eza' && alias la='eza --all --long'
if command -v bat >/dev/null 2>&1; then
    alias cat='bat'
elif command -v batcat >/dev/null 2>&1; then
    alias bat='batcat'
    alias cat='batcat'
fi
if ! command -v fd >/dev/null 2>&1 && command -v fdfind >/dev/null 2>&1; then
    alias fd='fdfind'
fi
root() {
    dotfiles_git_root=$(git rev-parse --show-toplevel) || return
    cd "$dotfiles_git_root" || return
    unset dotfiles_git_root
}
update_repos() { bash "$DOTFILES_DIR/scripts/update-repos.sh" "$@"; }
update_deps() { bash "$DOTFILES_DIR/install.sh" --update "$@"; }
:
