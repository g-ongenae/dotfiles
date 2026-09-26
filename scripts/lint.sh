#!/usr/bin/env bash
# Check (or reformat) every shell script this repository owns.
#
#   scripts/lint.sh          # report formatting differences and ShellCheck findings
#   scripts/lint.sh --fix    # rewrite the files with shfmt, then run ShellCheck
#
# Formatting comes from shfmt, configured by the `[*.{sh,bash,zsh}]` section of
# `.editorconfig`. Correctness comes from ShellCheck, configured by
# `.shellcheckrc`. Both tools are installed by every profile of this repository.

set -euo pipefail

DOTFILES_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DOTFILES_ROOT"

fix=false
case "${1:-}" in
  --fix) fix=true ;;
  '') ;;
  *)
    echo "Usage: scripts/lint.sh [--fix]" >&2
    exit 2
    ;;
esac

# Every shell file this repository holds -- tracked or newly added -- except the
# vendored Zsh plugins, which are upstream submodules and are not ours to
# reformat. ShellCheck has no Zsh dialect, so Zsh files are formatted but not
# checked.
#
# Read with a loop rather than `mapfile` so this also runs under the Bash 3.2
# that macOS ships in /bin.
all_files=()
checked_files=()
while IFS= read -r file; do
  all_files+=("$file")
  case "$file" in
    *.zsh) ;;
    *) checked_files+=("$file") ;;
  esac
done < <(git ls-files --cached --others --exclude-standard -- '*.sh' '*.bash' '*.zsh' |
  grep -v '^zsh/plugins/')

require() {
  if ! command -v "$1" > /dev/null 2>&1; then
    echo "scripts/lint.sh: $1 is not installed. Run ./install.sh --apply --only packages" >&2
    exit 127
  fi
}

require shfmt
require shellcheck

status=0

if "$fix"; then
  echo "==> shfmt --write"
  shfmt --write -- "${all_files[@]}"
else
  echo "==> shfmt --diff"
  shfmt --diff -- "${all_files[@]}" || status=1
fi

echo "==> shellcheck"
shellcheck -- "${checked_files[@]}" || status=1

if [ "$status" -eq 0 ]; then
  echo "All shell files pass."
fi
exit "$status"
