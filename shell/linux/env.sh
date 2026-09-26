# shellcheck shell=sh
# Linux PATH additions, sourced from shell/common/init.sh on Fedora and Debian.

# Flatpak desktop launchers on Fedora; Debian does not install Flatpak.
if [ "${DOTFILES_PROFILE:-}" = fedora ]; then
  # Per-user installs first, then the system-wide ones.
  dotfiles_prepend_path "$HOME/.local/share/flatpak/exports/bin"
  dotfiles_prepend_path /var/lib/flatpak/exports/bin
fi

# Succeed unconditionally, so sourcing this file never looks like a failure.
:
