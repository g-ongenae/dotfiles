case $- in *i*) ;; *) return 0 ;; esac
[ "${DOTFILES_BASH_INITIALIZED:-}" = 1 ] && return 0
DOTFILES_BASH_INITIALIZED=1
. "$DOTFILES_DIR/shell/interactive/aliases.sh"
HISTSIZE=50000
HISTFILESIZE=100000
HISTCONTROL=ignoreboth
shopt -s histappend

if [ -r /usr/share/bash-completion/bash_completion ]; then
    . /usr/share/bash-completion/bash_completion
elif [ -r "${HOMEBREW_PREFIX:-}/etc/profile.d/bash_completion.sh" ]; then
    . "$HOMEBREW_PREFIX/etc/profile.d/bash_completion.sh"
fi
command -v fnm >/dev/null 2>&1 && eval "$(fnm env --use-on-cd --shell bash)"
if command -v fzf >/dev/null 2>&1; then
    if dotfiles_fzf=$(fzf --bash 2>/dev/null); then
        eval "$dotfiles_fzf"
    elif [ -r /usr/share/doc/fzf/examples/key-bindings.bash ]; then
        . /usr/share/doc/fzf/examples/key-bindings.bash
        . /usr/share/doc/fzf/examples/completion.bash
    fi
    unset dotfiles_fzf
fi
command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init bash)"
command -v starship >/dev/null 2>&1 && eval "$(starship init bash)"
command -v atuin >/dev/null 2>&1 && eval "$(atuin init bash)"
case "${DOTFILES_PROFILE:-}" in
    macos) . "$DOTFILES_DIR/shell/macos/interactive.sh" ;;
    fedora|debian-server) . "$DOTFILES_DIR/shell/linux/interactive.sh" ;;
esac
if [ -r "$HOME/.config/dotfiles/local.bash" ]; then
    . "$HOME/.config/dotfiles/local.bash"
fi
:
