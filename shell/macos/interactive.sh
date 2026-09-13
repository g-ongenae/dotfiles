alias b='brew'
alias vscode='code'
if [ -n "${ZSH_VERSION:-}" ]; then
    alias p='nocorrect pnpm'
    alias nx='nocorrect pnpm exec nx'
fi
q() { osascript -e 'tell application "Terminal" to quit'; }
alias local_ip='ipconfig getifaddr en0'
alias rp='lsof -nP -iTCP -sTCP:LISTEN'
alias d='docker'
alias ks='kubectl'
dev() { bash "$DOTFILES_DIR/scripts/devcontainer.sh" "$@"; }
if [ -n "${ZSH_VERSION:-}" ]; then
    command -v kubectl >/dev/null 2>&1 && eval "$(kubectl completion zsh)"
else
    command -v kubectl >/dev/null 2>&1 && eval "$(kubectl completion bash)"
fi
if [ -r "${HOMEBREW_PREFIX:-}/opt/kube-ps1/share/kube-ps1.sh" ]; then
    . "$HOMEBREW_PREFIX/opt/kube-ps1/share/kube-ps1.sh"
    kubeoff
fi
:
