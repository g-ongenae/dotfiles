#!/usr/bin/env bash
# Control an existing T3 Code user service, locally or over SSH.
#
# The service itself is created by `t3 setup`, which delegates to
# scripts/t3-service.py. Everything else here maps an action onto a command:
#
#   * on Linux, systemctl/journalctl against the t3code.service user unit;
#   * on macOS, scripts/t3-service.py, which drives launchd;
#   * connect/disconnect, which publish the local server over Tailscale Serve;
#   * update, which runs scripts/t3-update.py here or on the server;
#   * pair/devices/revoke, which ask the server's own T3 CLI about the devices
#     allowed to reach it.
#
# With T3_HOST set, the chosen command is sent to that host over SSH instead of
# being run here.

usage() {
  printf '%s\n' 'Usage: t3 [setup|start|restart|stop|inspect|status|logs|update]' \
    '       t3 [connect [nosleep]|disconnect|pair [label]|devices|revoke <id>]' \
    'Set T3_HOST=user@tailnet-host to control a remote Linux server.' \
    'update updates the T3 CLI and the agents installed on the machine.' \
    'connect/disconnect enable/disable Tailscale Serve HTTPS on port 3773.' \
    'connect [nosleep|--nosleep] also inhibits sleep on the Linux server until disconnect or server exit.' \
    'connect prints a fresh pairing URL, pairing code, and QR code on every platform.' \
    'A pairing token is one-time, so every device needs its own: pair [label] mints one.' \
    'devices lists paired sessions and unused tokens; revoke <id> drops one of them.'
}

# --- Helpers shipped to remote hosts -----------------------------------------
#
# The functions below are serialized with `declare -f` and sent over SSH, so
# each one must stand on its own: no shared state, no dotfiles on the far end.
# Only t3_cli is shared, and every payload that needs it says so.

# Run the server's own T3 CLI: the npm package, the Debian wrapper, or the
# extracted AppImage, whose Electron binary has to be run as plain Node.
#
# Runs in a subshell -- `(` rather than `{` -- so that ELECTRON_RUN_AS_NODE
# reaches the command that needs it and nothing else.
t3_cli() (
  local runtime="$HOME/.local/share/dotfiles/t3/appimage"
  local -a cli
  if command -v t3 > /dev/null 2>&1; then
    cli=(t3)
  elif command -v t3code-server > /dev/null 2>&1; then
    cli=(t3code-server)
  elif [ -x "$runtime/t3code" ]; then
    export ELECTRON_RUN_AS_NODE=1
    cli=("$runtime/t3code" "$runtime/resources/app.asar/apps/server/dist/bin.mjs")
  else
    printf 't3: install a current T3 CLI on the server to pair devices or list them.\n' >&2
    return 127
  fi

  command "${cli[@]}" "$@"
)

# Print the pairing URL, code and QR code for the running server, for one
# device. The token is one-time, so a second device needs a second call; an
# optional label is what tells them apart in `t3 devices`.
#
# Runs in a subshell -- `(` rather than `{` -- so the PATH change and the EXIT
# trap below cannot leak into the caller.
pair_t3() (
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

  local -a label=()
  [ -n "${1:-}" ] && label=(--label "$1")

  # Capture both streams: a failure has to be inspected before it is shown.
  local output result
  output=$(t3_cli pair --tailscale --tailscale-serve-port 3773 "${label[@]}" 2>&1)
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

# List every device that can reach this server: the sessions devices hold once
# paired, then any token minted and not yet used. Neither reveals a secret.
t3_devices() (
  t3_cli --log-level none auth session list || return "$?"
  t3_cli --log-level none auth pairing list
)

# Drop one id, from whichever of those two lists it came.
#
# The CLI reports an id it does not hold rather than failing, so both lists are
# asked and one of the two answers is a line saying it held nothing.
t3_revoke() (
  t3_cli --log-level none auth session revoke "$1" || return "$?"
  t3_cli --log-level none auth pairing revoke "$1"
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

# Three invocations take a second word: `connect nosleep`, the label `pair`
# accepts, and the id `revoke` requires. Everything else is a single action.
nosleep=false
argument=
if [ "$#" -eq 2 ]; then
  case "$1" in
    connect)
      if [ "$2" = nosleep ] || [ "$2" = --nosleep ]; then
        nosleep=true
      else
        usage >&2
        exit 2
      fi
      ;;
    pair | revoke) argument=$2 ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
elif [ "$#" -gt 2 ]; then
  usage >&2
  exit 2
fi

action=${1:-inspect}

# A label or an id is the only part of a command that does not come from this
# script, and it is pasted into a shell on the far end of an SSH connection.
# Keep it to characters that cannot end an argument and start a command, and
# to a first character that the T3 CLI cannot read as a flag of its own.
if [ -n "$argument" ] && [[ ! "$argument" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  printf 't3: a label or id starts with a letter or digit, then takes letters, digits, dot, dash and underscore.\n' >&2
  exit 2
fi

if [ "$action" = revoke ] && [ -z "$argument" ]; then
  printf 't3: revoke needs the id of a session or a token; run t3 devices for them.\n' >&2
  exit 2
fi

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
  # The updater stands on its own, so the remote branch can send it a copy.
  update) set -- python3 "${DOTFILES_DIR:?}/scripts/t3-update.py" ;;
  # Asking the T3 CLI is the same work here and on a server, so these three
  # map onto a function rather than onto a command to run or forward.
  pair | devices | revoke) ;;
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
    connect) exec ssh -t -- "$T3_HOST" "$(declare -f t3_cli pair_t3 start_t3_nosleep)
$* && { if $nosleep; then start_t3_nosleep; fi; } && pair_t3" ;;
    disconnect) exec ssh -t -- "$T3_HOST" "$(declare -f stop_t3_nosleep disconnect_t3)
disconnect_t3" ;;
    # This checkout's updater, read by the server's python3 from the SSH
    # connection, so that the server needs no checkout of its own.
    update) exec ssh -- "$T3_HOST" python3 - < "${DOTFILES_DIR:?}/scripts/t3-update.py" ;;
    # A label and an id reach the far end inside single quotes, which the
    # characters allowed above cannot close. pair wants a terminal for its QR
    # code; the other two only print text.
    pair) exec ssh -t -- "$T3_HOST" "$(declare -f t3_cli pair_t3)
pair_t3 '$argument'" ;;
    devices) exec ssh -- "$T3_HOST" "$(declare -f t3_cli t3_devices)
t3_devices" ;;
    revoke) exec ssh -- "$T3_HOST" "$(declare -f t3_cli t3_revoke)
t3_revoke '$argument'" ;;
  esac

  exec ssh -- "$T3_HOST" "$*"
fi

# --- Local: the T3 CLI's own answers -----------------------------------------
#
# Pairing and the lists behind it are the same work on either platform, so they
# answer here rather than through the launchd and systemd branches below.

case "$action" in
  pair)
    pair_t3 "$argument"
    exit "$?"
    ;;
  devices)
    t3_devices
    exit "$?"
    ;;
  revoke)
    t3_revoke "$argument"
    exit "$?"
    ;;
esac

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
  local pid=$!
  { sleep "$tailscale_deadline" && kill -KILL -"$pid"; } 2> /dev/null &
  local timer=$!

  # The redirection drops the shell's own "Killed" job notice, not CLI output.
  wait "$pid" 2> /dev/null
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
    # The updater is the same on both platforms.
    update) exec "$@" ;;
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
