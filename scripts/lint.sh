#!/usr/bin/env bash
# Check (or reformat) every file this repository owns.
#
#   scripts/lint.sh          # report formatting differences and lint findings
#   scripts/lint.sh --fix    # rewrite the files in place, then report what is left
#
# Shell files: formatting comes from shfmt, configured by the `[*.{sh,bash,zsh}]`
# section of `.editorconfig`, and correctness from ShellCheck, configured by
# `.shellcheckrc`. Both are installed by every profile of this repository.
#
# Python files: linting and formatting come from Ruff, configured by `ruff.toml`.
# It runs through uvx at the version pinned below.
#
# Markdown, YAML, JSON and JavaScript: formatting comes from Prettier,
# configured by `.prettierrc.json` and `.prettierignore`. It runs through npx at
# the version pinned below, so this repository has no package.json to install.

set -euo pipefail

RUFF_VERSION=0.17.5
PRETTIER_VERSION=3.10.0

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
require uvx
require npx

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

# Ruff finds its own files, skipping what Git and `ruff.toml` exclude.
if "$fix"; then
  echo "==> ruff format"
  uvx "ruff@$RUFF_VERSION" format .
  echo "==> ruff check --fix"
  uvx "ruff@$RUFF_VERSION" check --fix . || status=1
else
  echo "==> ruff format --diff"
  uvx "ruff@$RUFF_VERSION" format --diff . || status=1
  echo "==> ruff check"
  uvx "ruff@$RUFF_VERSION" check . || status=1
fi

# Prettier finds its own files, skipping what Git and `.prettierignore` ignore.
if "$fix"; then
  echo "==> prettier --write"
  npx --yes "prettier@$PRETTIER_VERSION" --log-level warn --write .
else
  echo "==> prettier --check"
  npx --yes "prettier@$PRETTIER_VERSION" --log-level warn --check . || status=1
fi

if [ "$status" -eq 0 ]; then
  echo "All files pass."
fi
exit "$status"
