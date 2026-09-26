# shellcheck shell=sh
# Linux-only prompt aliases, sourced on Fedora and Debian.

# Listening TCP sockets and the processes owning them.
alias rp='ss -ltnp'
alias local_ip='hostname -I'

# Fedora installs VSCodium rather than VS Code.
if [ "${DOTFILES_PROFILE:-}" = fedora ]; then
  alias vscode='codium'
fi

# Do not replace Linux's `ip` command with a desktop-only alias.

# Succeed unconditionally, so sourcing this file never looks like a failure.
:
