# shellcheck shell=sh
# macOS PATH additions, sourced from shell/common/init.sh.

# Homebrew on Apple Silicon or Intel. Do not execute brew for every SSH command.
if [ -x /opt/homebrew/bin/brew ]; then
  export HOMEBREW_PREFIX=/opt/homebrew
elif [ -x /usr/local/bin/brew ]; then
  export HOMEBREW_PREFIX=/usr/local
fi

if [ -n "${HOMEBREW_PREFIX:-}" ]; then
  dotfiles_prepend_path "$HOMEBREW_PREFIX/sbin"
  dotfiles_prepend_path "$HOMEBREW_PREFIX/bin"

  # Expose the GNU tools under their unprefixed names (`sed`, not `gsed`), the
  # way Linux provides them, so scripts behave the same on every profile.
  for dotfiles_formula in coreutils gnu-sed grep gnu-which make gpatch; do
    dotfiles_prepend_path "$HOMEBREW_PREFIX/opt/$dotfiles_formula/libexec/gnubin"
  done

  # Homebrew's OpenSSL, ahead of the much older system one.
  dotfiles_prepend_path "$HOMEBREW_PREFIX/opt/openssl@3/bin"

  unset dotfiles_formula
fi

# Volta is kept for existing projects, but shell/common/init.sh puts fnm ahead
# of it afterwards.
export VOLTA_HOME="$HOME/.volta"
dotfiles_prepend_path "$VOLTA_HOME/bin"

# The `code` command shipped inside the VS Code application bundle.
dotfiles_prepend_path /Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin

# kubectl plugins installed by krew.
dotfiles_prepend_path "${KREW_ROOT:-$HOME/.krew}/bin"

# Succeed unconditionally, so sourcing this file never looks like a failure.
:
