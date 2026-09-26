# shellcheck shell=sh
# The `t3` helper, shared by every shell.
#
# Definitions only: this file is also sourced by noninteractive SSH shells,
# where printing anything or running a subprocess would corrupt command output.

# Always run the script under Bash, whichever shell calls it.
t3() { bash "$DOTFILES_DIR/scripts/t3.sh" "$@"; }
