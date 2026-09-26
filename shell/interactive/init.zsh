# Prompt setup for Zsh. Sourced from ~/.zshrc; ~/.zshenv loads the shared
# environment in shell/common/init.sh.

# Do nothing at all in a noninteractive shell, and only once per session.
[[ -o interactive ]] || return 0
[[ ${DOTFILES_ZSH_INITIALIZED:-} = 1 ]] && return 0
DOTFILES_ZSH_INITIALIZED=1

. "$DOTFILES_DIR/shell/common/t3.sh"
. "$DOTFILES_DIR/shell/interactive/aliases.sh"

# --- History -----------------------------------------------------------------

HISTFILE="$HOME/.zsh_history"
HISTSIZE=50000
SAVEHIST=100000
# Share history live between shells, dropping duplicates and space-prefixed lines.
setopt APPEND_HISTORY SHARE_HISTORY HIST_IGNORE_DUPS HIST_IGNORE_SPACE

# Emacs keybindings, regardless of the value of $EDITOR.
bindkey -e

# --- Completion --------------------------------------------------------------

# Extra completion definitions, installed from upstream on Linux.
if [[ -d "$HOME/.local/share/dotfiles/zsh-completions/src" ]]; then
  fpath=("$HOME/.local/share/dotfiles/zsh-completions/src" $fpath)
fi

# Completions shipped by Homebrew formulae, found here through fpath.
if [[ -n ${HOMEBREW_PREFIX:-} ]]; then
  fpath=("$HOMEBREW_PREFIX/share/zsh/site-functions" $fpath)
fi

autoload -Uz compinit
compinit

# --- Prompt integrations -----------------------------------------------------

# Node version switching on directory change.
command -v fnm > /dev/null 2>&1 && eval "$(fnm env --use-on-cd --shell zsh)"

# fzf keybindings: recent versions print them, older Debian ships files.
if command -v fzf > /dev/null 2>&1; then
  if dotfiles_fzf=$(fzf --zsh 2> /dev/null); then
    eval "$dotfiles_fzf"
  elif [[ -r /usr/share/doc/fzf/examples/key-bindings.zsh ]]; then
    . /usr/share/doc/fzf/examples/key-bindings.zsh
    . /usr/share/doc/fzf/examples/completion.zsh
  fi
  unset dotfiles_fzf
fi

command -v zoxide > /dev/null 2>&1 && eval "$(zoxide init zsh)"
command -v starship > /dev/null 2>&1 && eval "$(starship init zsh)"
command -v atuin > /dev/null 2>&1 && eval "$(atuin init zsh)"

# --- Per-profile additions ---------------------------------------------------

case "${DOTFILES_PROFILE:-}" in
  macos) . "$DOTFILES_DIR/shell/macos/interactive.sh" ;;
  fedora | debian-server) . "$DOTFILES_DIR/shell/linux/interactive.sh" ;;
esac

# --- Plugins -----------------------------------------------------------------

# Keep the existing pinned submodules in their original paths.
# Upstreams name their entrypoint either <plugin>.zsh or <plugin>.plugin.zsh,
# so try both and stop at the first one that exists.
for dotfiles_plugin in zsh-autosuggestions zsh-syntax-highlighting nx-completion jq; do
  for dotfiles_plugin_path in \
    "$DOTFILES_DIR/zsh/plugins/$dotfiles_plugin/$dotfiles_plugin.zsh" \
    "$DOTFILES_DIR/zsh/plugins/$dotfiles_plugin/$dotfiles_plugin.plugin.zsh"; do
    [[ -r "$dotfiles_plugin_path" ]] && . "$dotfiles_plugin_path" && break
  done
done
unset dotfiles_plugin dotfiles_plugin_path

# --- Uncommitted additions ---------------------------------------------------

# Private aliases kept out of this repository.
if [[ -r "$DOTFILES_DIR/zsh/secret/alias.zsh" ]]; then
  . "$DOTFILES_DIR/zsh/secret/alias.zsh"
fi

# Personal, uncommitted additions for this machine.
if [[ -r "$HOME/.config/dotfiles/local.zsh" ]]; then
  . "$HOME/.config/dotfiles/local.zsh"
fi

# Succeed unconditionally, so sourcing this file never looks like a failure.
:
