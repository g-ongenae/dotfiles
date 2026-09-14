[[ -o interactive ]] || return 0
[[ ${DOTFILES_ZSH_INITIALIZED:-} = 1 ]] && return 0
DOTFILES_ZSH_INITIALIZED=1
. "$DOTFILES_DIR/shell/common/t3.sh"
. "$DOTFILES_DIR/shell/interactive/aliases.sh"
HISTFILE="$HOME/.zsh_history"
HISTSIZE=50000
SAVEHIST=100000
setopt APPEND_HISTORY SHARE_HISTORY HIST_IGNORE_DUPS HIST_IGNORE_SPACE
bindkey -e
if [[ -d "$HOME/.local/share/dotfiles/zsh-completions/src" ]]; then
    fpath=("$HOME/.local/share/dotfiles/zsh-completions/src" $fpath)
fi
if [[ -n ${HOMEBREW_PREFIX:-} ]]; then
    fpath=("$HOMEBREW_PREFIX/share/zsh/site-functions" $fpath)
fi
autoload -Uz compinit
compinit
command -v fnm >/dev/null 2>&1 && eval "$(fnm env --use-on-cd --shell zsh)"
if command -v fzf >/dev/null 2>&1; then
    if dotfiles_fzf=$(fzf --zsh 2>/dev/null); then
        eval "$dotfiles_fzf"
    elif [[ -r /usr/share/doc/fzf/examples/key-bindings.zsh ]]; then
        . /usr/share/doc/fzf/examples/key-bindings.zsh
        . /usr/share/doc/fzf/examples/completion.zsh
    fi
    unset dotfiles_fzf
fi
command -v zoxide >/dev/null 2>&1 && eval "$(zoxide init zsh)"
command -v starship >/dev/null 2>&1 && eval "$(starship init zsh)"
command -v atuin >/dev/null 2>&1 && eval "$(atuin init zsh)"
case "${DOTFILES_PROFILE:-}" in
    macos) . "$DOTFILES_DIR/shell/macos/interactive.sh" ;;
    fedora|debian-server) . "$DOTFILES_DIR/shell/linux/interactive.sh" ;;
esac
# Keep the existing pinned submodules in their original paths.
for dotfiles_plugin in zsh-autosuggestions zsh-syntax-highlighting; do
    dotfiles_plugin_path="$DOTFILES_DIR/zsh/plugins/$dotfiles_plugin/$dotfiles_plugin.zsh"
    [[ -r "$dotfiles_plugin_path" ]] && . "$dotfiles_plugin_path"
done
unset dotfiles_plugin dotfiles_plugin_path
if [[ -r "$DOTFILES_DIR/zsh/secret/alias.zsh" ]]; then
    . "$DOTFILES_DIR/zsh/secret/alias.zsh"
fi
if [[ -r "$HOME/.config/dotfiles/local.zsh" ]]; then
    . "$HOME/.config/dotfiles/local.zsh"
fi
:
