#!/usr/bin/env bash
# Control an existing T3 Code user service, locally or over SSH.

usage() {
    printf '%s\n' 'Usage: t3 [setup|start|restart|stop|inspect|status|logs|connect|disconnect]' \
        'Set T3_HOST=user@tailnet-host to control a remote Linux server.' \
        'connect/disconnect enable/disable Tailscale Serve HTTPS on port 3773.'
}

if [ "$#" -gt 1 ]; then
    usage >&2
    exit 2
fi
action=${1:-inspect}
case "$action" in
    setup)
        if [ -n "${T3_HOST:-}" ]; then
            printf 't3: run setup locally on the server, with T3_HOST unset.\n' >&2
            exit 2
        fi
        exec python3 "${DOTFILES_DIR:?}/scripts/t3-service.py" setup
        ;;
    start|restart|stop) set -- systemctl --user "$1" t3code.service ;;
    inspect|status) set -- systemctl --user status t3code.service --no-pager --full ;;
    logs) set -- journalctl --user -u t3code.service -n 100 -f ;;
    connect) set -- sudo tailscale serve --bg --https=3773 http://127.0.0.1:3773 ;;
    disconnect) set -- sudo tailscale serve --https=3773 off ;;
    help|-h|--help) usage; exit 0 ;;
    *) printf 'Unknown action: %s\n' "$1" >&2; usage >&2; exit 2 ;;
esac

if [ -n "${T3_HOST:-}" ]; then
    # Every remote command word comes from the fixed action table above.
    case "$action" in
        connect|disconnect) exec ssh -t -- "$T3_HOST" "$*" ;;
    esac
    exec ssh -- "$T3_HOST" "$*"
fi
if [ "${DOTFILES_PROFILE:-}" = macos ]; then
    case "$action" in
        connect|disconnect)
            if command -v tailscale >/dev/null 2>&1; then
                set -- tailscale "${@:3}"
            elif [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then
                set -- /Applications/Tailscale.app/Contents/MacOS/Tailscale "${@:3}"
            else
                printf 't3: install and open the Tailscale app first.\n' >&2
                exit 127
            fi
            exec "$@"
            ;;
        *) exec python3 "${DOTFILES_DIR:?}/scripts/t3-service.py" "$action" ;;
    esac
fi
case "$action" in
    connect|disconnect)
        if ! command -v tailscale >/dev/null 2>&1; then
            printf 't3: install Tailscale on this Linux server, or set T3_HOST=user@tailnet-host.\n' >&2
            exit 127
        fi
        ;;
esac
if ! command -v "$1" >/dev/null 2>&1; then
    printf 't3: %s is unavailable; set T3_HOST=user@tailnet-host to control a Linux server.\n' "$1" >&2
    exit 127
fi
exec "$@"
