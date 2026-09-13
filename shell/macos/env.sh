# Homebrew on Apple Silicon or Intel. Do not execute brew for every SSH command.
if [ -x /opt/homebrew/bin/brew ]; then
    export HOMEBREW_PREFIX=/opt/homebrew
elif [ -x /usr/local/bin/brew ]; then
    export HOMEBREW_PREFIX=/usr/local
fi
if [ -n "${HOMEBREW_PREFIX:-}" ]; then
    dotfiles_prepend_path "$HOMEBREW_PREFIX/sbin"
    dotfiles_prepend_path "$HOMEBREW_PREFIX/bin"
    for dotfiles_formula in coreutils gnu-sed grep gnu-which make gpatch; do
        dotfiles_prepend_path "$HOMEBREW_PREFIX/opt/$dotfiles_formula/libexec/gnubin"
    done
    dotfiles_prepend_path "$HOMEBREW_PREFIX/opt/openssl@3/bin"
    unset dotfiles_formula
fi
export VOLTA_HOME="$HOME/.volta"
dotfiles_prepend_path "$VOLTA_HOME/bin"
dotfiles_prepend_path /Applications/Visual\ Studio\ Code.app/Contents/Resources/app/bin
dotfiles_prepend_path "${KREW_ROOT:-$HOME/.krew}/bin"
:
