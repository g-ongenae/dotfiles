# shellcheck shell=bash
# macOS-only prompt aliases, helpers and completions.
#
# Sourced by both Bash and Zsh, hence the dialect checks below. It is declared
# as Bash for ShellCheck's benefit, because ShellCheck has no Zsh dialect.

# --- Everyday shortcuts ------------------------------------------------------

alias b='brew'
alias vscode='code'
alias d='docker'
alias ks='kubectl'

# `nocorrect` stops Zsh from offering to "fix" pnpm into pnpm-lock and friends.
if [ -n "${ZSH_VERSION:-}" ]; then
  alias p='nocorrect pnpm'
else
  alias p='pnpm'
fi

# Close the whole Terminal application, not just this window.
q() { osascript -e 'tell application "Terminal" to quit'; }

# --- Network inspection ------------------------------------------------------

alias local_ip='ipconfig getifaddr en0'
# Listening TCP sockets, the macOS equivalent of Linux's `ss -ltnp`.
alias rp='lsof -nP -iTCP -sTCP:LISTEN'

# --- Dev Containers ----------------------------------------------------------

dev() { bash "$DOTFILES_DIR/scripts/devcontainer.sh" "$@"; }

# --- Kubernetes --------------------------------------------------------------

# kubectl generates its own completion; Apple's Bash 3.2 cannot load it.
if [ -n "${ZSH_VERSION:-}" ]; then
  command -v kubectl > /dev/null 2>&1 && eval "$(kubectl completion zsh)"
elif [ "${BASH_VERSINFO[0]:-0}" -ge 4 ]; then
  command -v kubectl > /dev/null 2>&1 && eval "$(kubectl completion bash)"
fi

# Show the current cluster/namespace in the prompt, starting out switched off.
if { [ -n "${ZSH_VERSION:-}" ] || [ "${BASH_VERSINFO[0]:-0}" -ge 4 ]; } &&
  [ -r "${HOMEBREW_PREFIX:-}/opt/kube-ps1/share/kube-ps1.sh" ]; then
  . "$HOMEBREW_PREFIX/opt/kube-ps1/share/kube-ps1.sh"
  kubeoff
fi

# Succeed unconditionally, so sourcing this file never looks like a failure.
:
