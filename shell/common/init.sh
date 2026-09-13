# Shared environment for Bash and Zsh, including noninteractive SSH commands.
# Keep this POSIX-compatible, silent, and free of subprocesses or prompt hooks.
[ -n "${DOTFILES_DIR:-}" ] || return 0

dotfiles_prepend_path() {
    [ -d "$1" ] || return 0
    # Move an existing entry too: an inherited Volta PATH must not outrank fnm.
    dotfiles_path_rest=${PATH:-}
    dotfiles_path_new=$1
    while [ -n "$dotfiles_path_rest" ]; do
        dotfiles_path_part=${dotfiles_path_rest%%:*}
        if [ -n "$dotfiles_path_part" ] && [ "$dotfiles_path_part" != "$1" ]; then
            dotfiles_path_new="$dotfiles_path_new:$dotfiles_path_part"
        fi
        case $dotfiles_path_rest in
            *:*) dotfiles_path_rest=${dotfiles_path_rest#*:} ;;
            *) break ;;
        esac
    done
    PATH=$dotfiles_path_new
    unset dotfiles_path_rest dotfiles_path_new dotfiles_path_part
}

export ADBLOCK=1 HOMEBREW_NO_ANALYTICS=1
export EDITOR=vim VISUAL=vim
export FNM_DIR="$HOME/.local/share/fnm"
dotfiles_prepend_path "$HOME/go/bin"
case "${DOTFILES_PROFILE:-}" in
    macos) . "$DOTFILES_DIR/shell/macos/env.sh" ;;
    fedora|debian-server) . "$DOTFILES_DIR/shell/linux/env.sh" ;;
esac
dotfiles_prepend_path "$FNM_DIR"
dotfiles_prepend_path "$HOME/.local/bin"
# A fixed default Node path gives SSH/builds Node without running fnm on startup.
if [ -r "$HOME/.config/dotfiles/node-path.sh" ]; then
    . "$HOME/.config/dotfiles/node-path.sh"
fi
if [ "${DOTFILES_PROFILE:-}" = debian-server ]; then
    . "$DOTFILES_DIR/shell/server/env.sh"
fi
if [ -f "$DOTFILES_DIR/secret/starship.toml" ]; then
    export STARSHIP_CONFIG="$DOTFILES_DIR/secret/starship.toml"
fi
export PATH
:
