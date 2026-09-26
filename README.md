# dotfiles

One checkout, three profiles: macOS desktop, Fedora Workstation desktop, and
Debian 13 SSH/server/builder.

A Python installer reads a profile's manifests and brings a machine up to it:
packages, shell configuration, editor extensions, Git identity and browser
routing. The shell layer keeps environment apart from prompt, so scripts and
noninteractive SSH commands get the right PATH without paying for completion and
prompt setup. Anything it would replace is backed up first, and a preview run
shows the whole plan without touching the machine.

## Install

Clone this repository into its permanent location. The installer uses that
checkout; it does not clone another copy, switch branches, or assume a
Documents directory.

**Prerequisites**

- Git.
- Homebrew and the Xcode command-line tools on macOS.
- Python 3. If it is missing, `install.sh` installs it with Homebrew, dnf or apt.
- sudo, for Linux package installation. Run as your normal user, not root.

**Commands**

```bash
./install.sh                                   # detect this machine, preview only
./install.sh --profile macos                   # preview any profile on any OS
./install.sh --profile fedora
./install.sh --profile debian-server
./install.sh --apply                           # install the detected profile
./install.sh --update                          # update its managed packages
```

Once Python is available, preview mode does not write files, launch installers,
or access the network.

- Applying a profile for a different OS is rejected.
- Fedora means dnf-based Workstation, not Atomic/rpm-ostree.
- Linux release binaries support x86_64 and aarch64, except the current Fedora
  Proxyman and Debian T3 Code AppImages, which are x86_64-only.

### Running selected steps

```bash
./install.sh --apply --only packages
./install.sh --apply --only shell
./install.sh --apply --only extensions,browsers
./install.sh --apply --only browsers --firefox-policy
```

Steps run in the order supplied. The default is
`packages,shell,extensions,browsers`.

`--only extensions` requires the profile's editor and fnm's default Node to be
installed already.

External installer failures stop the run. Editor-extension failures are
collected instead and produce a nonzero exit status. Rerun after correcting the
problem: this is not a transactional package rollback.

### What installation never does

It does **not** change your login shell, authenticate agents, enroll Tailscale,
configure firewalls, start T3 Code, or alter sshd. The Debian profile installs
an SSH client and assumes the server's existing SSH access is managed
separately. Keep an existing SSH session open when first applying shell changes.

## Documentation

- [Commands and tools](docs/commands.md) — the aliases, helpers and scripts you
  get at a prompt once this is installed.
- [Installer](docs/installer.md) — where each package comes from, and what the
  installer does to the files you already have.
- [Architecture](docs/architecture.md) — repository layout, how the shell files
  decide what to load, and how to validate a change.
- [T3 server helper](docs/t3.md) — controlling a T3 Code service locally or over
  SSH, and sharing it over Tailscale.

## License

[MIT](LICENSE).
