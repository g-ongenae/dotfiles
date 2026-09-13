alias rp='ss -ltnp'
alias local_ip='hostname -I'
if [ "${DOTFILES_PROFILE:-}" = fedora ]; then
    alias vscode='codium'
fi
# Do not replace Linux's `ip` command with a desktop-only alias.
:
