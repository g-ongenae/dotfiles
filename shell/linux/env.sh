# Flatpak desktop launchers on Fedora; Debian does not install Flatpak.
if [ "${DOTFILES_PROFILE:-}" = fedora ]; then
    dotfiles_prepend_path "$HOME/.local/share/flatpak/exports/bin"
    dotfiles_prepend_path /var/lib/flatpak/exports/bin
fi
:
