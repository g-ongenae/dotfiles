#!/usr/bin/env bash
# Control an existing T3 Code user service, locally or over SSH.
#
# The service itself is created by `t3 setup`, which delegates to
# scripts/t3-service.py. Everything else here maps an action onto a command:
#
#   * on Linux, systemctl/journalctl against the t3code.service user unit;
#   * on macOS, scripts/t3-service.py, which drives launchd;
#   * connect/disconnect, which publish the local server over Tailscale Serve.
#
# With T3_HOST set, the chosen command is sent to that host over SSH instead of
# being run here.

usage() {
  printf '%s\n' 'Usage: t3 [setup|start|restart|stop|inspect|status|logs|connect|disconnect]' \
    'Set T3_HOST=user@tailnet-host to control a remote Linux server.' \
    'connect/disconnect enable/disable Tailscale Serve HTTPS on port 3773.' \
    'connect [nosleep|--nosleep] also inhibits sleep on the Linux server until disconnect or server exit.' \
    'connect prints a fresh pairing URL, pairing code, and QR code on every platform.'
}

# --- Helpers shipped to remote hosts -----------------------------------------
#
# The three functions below are serialized with `declare -f` and sent over SSH,
# so each one must stand on its own: no shared state, no dotfiles on the far end.

# Print the pairing URL, code and QR code for the running server.
#
# Runs in a subshell -- `(` rather than `{` -- so the PATH change and the EXIT
# trap below cannot leak into the caller.
pair_t3() (
  local runtime="$HOME/.local/share/dotfiles/t3/appimage"

  # Upstream pair invokes lowercase `tailscale`, whereas the app bundles
  # an uppercase executable (also support case-sensitive macOS volumes).
  if ! command -v tailscale > /dev/null 2>&1 &&
    [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then
    local shim
    shim=$(mktemp -d) || return "$?"
    trap 'rm -rf -- "$shim"' EXIT
    ln -s /Applications/Tailscale.app/Contents/MacOS/Tailscale "$shim/tailscale" || return "$?"
    export PATH="$shim:$PATH"
  fi

  # Find a T3 CLI: the npm package, the Debian wrapper, or the extracted
  # AppImage, whose Electron binary has to be run as plain Node.
  if command -v t3 > /dev/null 2>&1; then
    set -- t3
  elif command -v t3code-server > /dev/null 2>&1; then
    set -- t3code-server
  elif [ -x "$runtime/t3code" ]; then
    export ELECTRON_RUN_AS_NODE=1
    set -- "$runtime/t3code" "$runtime/resources/app.asar/apps/server/dist/bin.mjs"
  else
    printf 't3: install a current T3 CLI with the pair command on the server to print pairing details.\n' >&2
    return 127
  fi

  # Capture both streams: a failure has to be inspected before it is shown.
  local output result
  output=$(command "$@" pair --tailscale --tailscale-serve-port 3773 2>&1)
  result=$?

  if [ "$result" -eq 0 ]; then
    printf '%s\n' "$output"
  elif [[ "$output" == *NoRunningServerError* ]]; then
    # Serve is up but the server's runtime discovery file is missing or stale.
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

# Keep these functions self-contained for remote hosts without dotfiles.

# Hold sleep off for as long as the T3 server runs (Linux only).
start_t3_nosleep() {
  local pid
  pid=$(systemctl --user show t3code.service --property=MainPID --value) || return "$?"

  # A stopped unit reports PID 0.
  if [[ ! "$pid" =~ ^[1-9][0-9]*$ ]]; then
    printf 't3: run t3 start before connecting with nosleep.\n' >&2
    return 1
  fi

  # Already inhibiting: repeated connects reuse the existing unit.
  systemctl --user is-active --quiet t3code-nosleep.service && return 0

  # A transient unit that holds a sleep lock while tailing the server's PID, and
  # that systemd stops together with the T3 service.
  systemd-run --user --unit=t3code-nosleep --collect \
    --property=BindsTo=t3code.service --property=After=t3code.service \
    systemd-inhibit --what=sleep --why="Waiting for process" \
    tail --pid="$pid" -f /dev/null
}

# Release the sleep inhibitor, tolerating a host that never started one.
stop_t3_nosleep() {
  local state
  state=$(systemctl --user show t3code-nosleep.service --property=LoadState --value) || return "$?"
  [ "$state" = not-found ] && return 0
  systemctl --user stop t3code-nosleep.service
}

# Stop sharing and release the inhibitor, reporting the first failure of the two.
disconnect_t3() {
  local result=0
  sudo tailscale serve --https=3773 off || result=$?
  stop_t3_nosleep || return "$?"
  return "$result"
}

# --- Argument parsing --------------------------------------------------------

# `connect nosleep` is the only two-word invocation accepted.
nosleep=false
if [ "$#" -eq 2 ] && [ "$1" = connect ] &&
  { [ "$2" = nosleep ] || [ "$2" = --nosleep ]; }; then
  nosleep=true
elif [ "$#" -gt 1 ]; then
  usage >&2
  exit 2
fi

action=${1:-inspect}

# --- Map the action onto a command -------------------------------------------
#
# Each branch leaves the command to run in "$@", which the sections below either
# execute here or forward over SSH. Actions that exit on their own do so
# immediately, since they have no remote or local form to choose between.

case "$action" in
  setup)
    if [ -n "${T3_HOST:-}" ]; then
      printf 't3: run setup locally on the server, with T3_HOST unset.\n' >&2
      exit 2
    fi
    exec python3 "${DOTFILES_DIR:?}/scripts/t3-service.py" setup
    ;;
  start | restart | stop) set -- systemctl --user "$1" t3code.service ;;
  inspect | status) set -- systemctl --user status t3code.service --no-pager --full ;;
  logs) set -- journalctl --user -u t3code.service -n 100 -f ;;
  connect) set -- sudo tailscale serve --bg --https=3773 http://127.0.0.1:3773 ;;
  disconnect) set -- sudo tailscale serve --https=3773 off ;;
  help | -h | --help)
    usage
    exit 0
    ;;
  *)
    printf 'Unknown action: %s\n' "$1" >&2
    usage >&2
    exit 2
    ;;
esac

# --- Remote: run the command on $T3_HOST over SSH ----------------------------

if [ -n "${T3_HOST:-}" ]; then
  # Every remote command word comes from the fixed action table above.
  case "$action" in
    # connect and disconnect need the helper functions on the far end, so their
    # definitions are sent along with the command. -t allocates a terminal for
    # the sudo password prompt.
    connect) exec ssh -t -- "$T3_HOST" "$(declare -f pair_t3 start_t3_nosleep)
$* && { if $nosleep; then start_t3_nosleep; fi; } && pair_t3" ;;
    disconnect) exec ssh -t -- "$T3_HOST" "$(declare -f stop_t3_nosleep disconnect_t3)
disconnect_t3" ;;
  esac

  exec ssh -- "$T3_HOST" "$*"
fi

# --- Local macOS -------------------------------------------------------------

# Seconds to wait for the Tailscale CLI before giving up on it; the tests
# shorten it.
tailscale_deadline=${T3_TAILSCALE_DEADLINE:-20}

# Run the Tailscale CLI under that deadline. A macOS app that is installed but
# not running answers its CLI neither with output nor with an error, so an
# unbounded call hangs the terminal until it is interrupted.
#
# Runs in a subshell -- `(` rather than `{` -- so job control stays local, and
# with it so that the CLI gets a process group of its own: killing that group
# reaches the app binary behind the /usr/local/bin/tailscale wrapper too.
run_tailscale() (
  set -m
  "$@" &
  local cli=$!
  { sleep "$tailscale_deadline" && kill -KILL -"$cli"; } 2> /dev/null &
  local timer=$!

  # The redirection drops the shell's own "Killed" job notice, not CLI output.
  wait "$cli" 2> /dev/null
  local result=$?
  kill -- -"$timer" 2> /dev/null # the group, so the sleep goes with its shell

  if [ "$result" -eq 137 ]; then
    printf 't3: Tailscale did not answer within %ss; open the Tailscale app, sign in, then retry.\n' \
      "$tailscale_deadline" >&2
    return 124 # what timeout(1) reports, since the command never answered
  fi

  return "$result"
)

if [ "${DOTFILES_PROFILE:-}" = macos ]; then
  if "$nosleep"; then
    printf 't3: nosleep requires a Linux server; set T3_HOST=user@tailnet-host.\n' >&2
    exit 2
  fi

  case "$action" in
    connect | disconnect)
      # Replace the leading `sudo tailscale` of the command built above with the
      # Tailscale CLI, which needs no sudo on macOS; "${@:3}" keeps its arguments.
      if command -v tailscale > /dev/null 2>&1; then
        set -- tailscale "${@:3}"
      elif [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then
        set -- /Applications/Tailscale.app/Contents/MacOS/Tailscale "${@:3}"
      else
        printf 't3: install and open the Tailscale app first.\n' >&2
        exit 127
      fi

      if [ "$action" = connect ]; then
        run_tailscale "$@" || exit "$?"
        pair_t3
        exit "$?"
      fi

      run_tailscale "$@"
      exit "$?"
      ;;
    # launchd, not systemd, runs the service on macOS.
    *) exec python3 "${DOTFILES_DIR:?}/scripts/t3-service.py" "$action" ;;
  esac
fi

# --- Local Linux -------------------------------------------------------------

case "$action" in
  connect | disconnect)
    if ! command -v tailscale > /dev/null 2>&1; then
      printf 't3: install Tailscale on this Linux server, or set T3_HOST=user@tailnet-host.\n' >&2
      exit 127
    fi
    ;;
esac

# "$1" is now the command chosen by the action table: systemctl, journalctl or sudo.
if ! command -v "$1" > /dev/null 2>&1; then
  printf 't3: %s is unavailable; set T3_HOST=user@tailnet-host to control a Linux server.\n' "$1" >&2
  exit 127
fi

# connect and disconnect are multi-step, so they cannot simply exec.
if [ "$action" = connect ]; then
  "$@" || exit "$?"

  if "$nosleep"; then
    start_t3_nosleep || exit "$?"
  fi

  pair_t3
  exit "$?"
fi

if [ "$action" = disconnect ]; then
  disconnect_t3
  exit "$?"
fi

exec "$@"
