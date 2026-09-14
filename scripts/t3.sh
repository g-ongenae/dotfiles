#!/usr/bin/env bash
# Control an existing T3 Code user service, locally or over SSH.

usage() {
    printf '%s\n' 'Usage: t3 [setup|start|restart|stop|inspect|status|logs|connect|disconnect]' \
        'Set T3_HOST=user@tailnet-host to control a remote Linux server.' \
        'connect/disconnect enable/disable Tailscale Serve HTTPS on port 3773.' \
        'connect prints a fresh pairing URL, pairing code, and QR code on every platform.'
}

# Use the executable, bypassing the interactive shell function named t3.
# Keep this function self-contained so it also works on hosts without dotfiles.
pair_t3() (
    local runtime="$HOME/.local/share/dotfiles/t3/appimage"
    # Upstream pair invokes lowercase `tailscale`, whereas the app bundles
    # an uppercase executable (also support case-sensitive macOS volumes).
    if ! command -v tailscale >/dev/null 2>&1 &&
        [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then
        local shim
        shim=$(mktemp -d) || return "$?"
        trap 'rm -rf -- "$shim"' EXIT
        ln -s /Applications/Tailscale.app/Contents/MacOS/Tailscale "$shim/tailscale" || return "$?"
        export PATH="$shim:$PATH"
    fi
    if command -v t3 >/dev/null 2>&1; then
        set -- t3
    elif command -v t3code-server >/dev/null 2>&1; then
        set -- t3code-server
    elif [ -x "$runtime/t3code" ]; then
        export ELECTRON_RUN_AS_NODE=1
        set -- "$runtime/t3code" "$runtime/resources/app.asar/apps/server/dist/bin.mjs"
    else
        printf 't3: install a current T3 CLI with the pair command on the server to print pairing details.\n' >&2
        return 127
    fi
    local output result
    output=$(command "$@" pair --tailscale --tailscale-serve-port 3773 2>&1)
    result=$?
    if [ "$result" -eq 0 ]; then
        printf '%s\n' "$output"
    elif [[ "$output" == *NoRunningServerError* ]]; then
        printf '%s\n' \
            't3: Tailscale sharing is enabled, but pairing could not discover the T3 server.' \
            'Run t3 status. If stopped, run t3 start; if already running, run t3 restart' \
            'to recreate its runtime discovery file (this briefly interrupts connections).' \
            'Then retry t3 connect. For a custom data directory, set T3CODE_HOME to match the service.' >&2
    else
        printf '%s\n' "$output" >&2
    fi
    return "$result"
)

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
        connect) exec ssh -t -- "$T3_HOST" "$(declare -f pair_t3)
$* && pair_t3" ;;
        disconnect) exec ssh -t -- "$T3_HOST" "$*" ;;
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
            if [ "$action" = connect ]; then
                "$@" || exit "$?"
                pair_t3
                exit "$?"
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
if [ "$action" = connect ]; then
    "$@" || exit "$?"
    pair_t3
    exit "$?"
fi
exec "$@"
