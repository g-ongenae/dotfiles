# dotfiles

One checkout, three profiles: macOS desktop, Fedora Workstation desktop, and Debian 13 SSH/server/builder.

## Install

Clone this repository into its permanent location. The installer uses that checkout;
it does not clone another copy, switch branches, or assume a Documents directory.

Prerequisites: Git, plus Homebrew and Xcode command-line tools on macOS. If
Python 3 is missing, `install.sh` installs it with Homebrew, dnf, or apt. Linux
package installation needs sudo. Run as your normal user, not root.

```bash
./install.sh                                  # detect this machine, preview only
./install.sh --profile macos                   # preview any profile on any OS
./install.sh --profile fedora
./install.sh --profile debian-server
./install.sh --apply                           # install the detected profile
./install.sh --update                          # update its managed packages
```

Once Python is available, preview mode does not write files, launch installers,
or access the network.
Applying a profile for a different OS is rejected. Fedora means dnf-based
Workstation, not Atomic/rpm-ostree. Linux release binaries support x86_64 and
aarch64 except the current Fedora Proxyman and Debian T3 Code AppImages, which
are x86_64-only.

Run selected steps independently:

```bash
./install.sh --apply --only packages
./install.sh --apply --only shell
./install.sh --apply --only extensions,browsers
./install.sh --apply --only browsers --firefox-policy
```

`--only extensions` requires the profile's editor and fnm's default Node already
installed. Steps run in the order supplied. The default is
`packages,shell,extensions,browsers`. External installer failures stop the run;
editor-extension failures are collected and produce a nonzero exit status.
Rerun after correcting the problem. This is not a transactional package rollback.

Installation does **not** change your login shell, authenticate agents, enroll
Tailscale, configure firewalls, start T3 Code, or alter sshd. The Debian profile
installs an SSH client and assumes the server's existing SSH access is managed
separately. Keep an existing SSH session open when first applying shell changes.

## Layout

```text
install.sh
profiles/
  common/
    packages.yaml            # shared non-native providers and agent selection
    npm-packages.yaml
    vscode-extension.yaml
    browser-extensions.yaml
  macos/
    Brewfile
  fedora/
    packages.yaml
  debian-server/
    packages.yaml
shell/
  common/                    # silent environment for Bash and Zsh
  interactive/               # prompt-only integrations and shared aliases
  macos/                     # Homebrew paths and Mac-specific commands
  linux/                     # Linux paths and network commands
  server/                    # terminal editor and headless Chromium environment
scripts/
  install.py                 # standard-library installer behind install.sh
tests/
  test_install.py
```

Packages live under `profiles/`, including provider/source selection. YAML files
deliberately use a small subset: top-level sections containing two-space-indented
lists of strings. Quote strings containing `: ` or ` #`; nested objects,
anchors and inline comments are rejected. No PyYAML bootstrap is needed.

`zsh/plugins/` retains the existing pinned autosuggestion/highlighting submodule
paths. Only those two plugins are initialized and loaded; Oh My Zsh, pipenv,
jq and Volta plugins are not required by the new shell setup.

## What belongs in interactive?

Anything needed by a person at a prompt: aliases, completion, keybindings,
history, Starship, Atuin, fzf, zoxide, and fnm's directory-change integration.
An interactive SSH session gets these too; “interactive” does not mean “desktop.”

`shell/common/` contains environment variables and PATH setup needed by scripts,
builds, and noninteractive SSH commands. It runs no external commands and prints
nothing. In Bash its managed block goes before the usual noninteractive
`.bashrc` early return; prompt setup goes after the user's existing configuration.
Zsh loads the common environment from `.zshenv` and prompts from `.zshrc`.
Ordinary noninteractive Bash scripts inherit their parent's environment; no
global `BASH_ENV` hook is installed.

All profiles use Vim as the shell's terminal editor. Git uses VS Code on macOS,
VSCodium on Fedora, and Vim on the server. Linux `ip` is left intact.
No uninstalled macOS locale is forced onto Linux.

Debian installs `wakeonlan` for sending magic packets and enables wake on supported
physical Ethernet adapters with `ethtool`. The `dotfiles-wakeonlan.service` unit
reapplies this after networking starts at boot; it does not restart networking.
Check results with `journalctl -u dotfiles-wakeonlan.service` and
`sudo ethtool <interface>` (look for `Wake-on: g`). Firmware/BIOS must also permit
Wake-on-LAN, and the machine must retain Ethernet power while asleep/off.
If a network manager later resets the setting, rerun
`sudo systemctl start dotfiles-wakeonlan.service`.
Fedora installs only the `wol` sender; macOS skips Wake-on-LAN setup.
Send a packet with `wakeonlan <MAC-address>` on Debian or `wol <MAC-address>` on Fedora.

## Package choices

| Component | macOS | Fedora | Debian server |
| --- | --- | --- | --- |
| Browser routing | Finicky | Switchyard (Flatpak) | — |
| Launcher | Raycast | Vicinae (COPR) | — |
| Browsers | LibreWolf, Firefox, Zen, Chrome, Ungoogled Chromium | LibreWolf, Firefox, Zen | Chromium for headless use |
| Editor | VS Code | VSCodium | Vim |
| Git GUI | GitHub Desktop | shiftkey's GitHub Desktop | — |
| Proxy inspector | Proxyman | Proxyman AppImage | — |
| Agents | Claude Code, Gemini CLI | Codex, Claude Code, Gemini CLI | Codex, Claude Code, Gemini CLI |
| Antigravity | Homebrew desktop app | Official RPM repository | — |
| T3 Code | npm package | npm package | upstream AppImage |

The Fedora Flatpak list also contains Apostrophe, Buffer, Drum Machine, Eloquent,
FocusWriter, OBS Studio, Sound Recorder, and SSH Pilot. Flameshot comes from dnf.
Switchyard needs first-run routing setup and selection as the default browser.

Gemini CLI uses the [official npm package](https://geminicli.com/docs/get-started/installation/)
with fnm's Node on every profile. Antigravity is a desktop application on macOS
and Fedora; the Debian server stays headless. Fedora uses Google's
[official repository](https://antigravity.google/download/linux), which currently
disables RPM signature checks in its published configuration. Agent sign-in
remains a manual first-run step.

macOS additionally installs the requested Google Cloud, Kubernetes, Terraform,
Helm, Telepresence, minikube, Wireshark, macFUSE, Docker Desktop, Insomnia, Volta,
and Dev Container CLI tools. Approve applications, system extensions, licenses,
and any debugger code-signing prompts yourself.

The Brewfile explicitly trusts the Telepresence, HashiCorp, Multi-Gitter and
MongoDB taps using Homebrew's
[`trusted: true` declarations](https://docs.brew.sh/Brew-Bundle-and-Brewfile#trusted).
The latter two support existing workstation installations during upgrades;
their packages and database services are not added automatically.

After Homebrew installation/upgrades, the macOS packages step removes
`com.apple.quarantine` from `/Applications/LibreWolf.app`, following the
[LibreWolf first-launch fix](https://librewolf.net/docs/faq/#why-is-librewolf-marked-as-broken).
This also repairs an existing installation when rerun. If you installed LibreWolf
in a custom application directory, apply `xattr -dr com.apple.quarantine` to that
app's path yourself.

Shared tools use native package managers where appropriate, plus upstream Linux
releases for Starship, Atuin, eza, difftastic, skim, zoxide, fnm, uv, hadolint and
yq. Linux yh uses Go; git-plus and tldr use isolated uv tool environments; fx
uses npm. Linux zsh-completions comes from its upstream repository and zsh-lovers
is saved as HTML under `~/.local/share/dotfiles/docs/`.

Name mappings and exceptions:

- `delta` / `git-delta`, `sk` / skim, and `kubectl` / `kubernetes-cli` are
  single tools, not duplicate installations.
- Linux supplies GNU sed, grep, patch, awk, which, watch and base64 through the
  distro packages. macOS installs GNU variants; shell PATH exposes their
  unprefixed names where Homebrew provides a `gnubin` directory.
- Debian names bat and fd executables `batcat` and `fdfind`; interactive aliases
  provide `bat` and `fd`. Scripts should use the distro executable names.

Git is upgraded through Homebrew on macOS. On Linux the installer resolves the
latest stable upstream Git tag and builds it under `~/.local`, ahead of the
distro Git in PATH. It requires compiler/development packages and can take a
few minutes. It does not replace `/usr/bin/git` or build documentation.

fnm installs the latest Node LTS and selects it as default on every profile.
A generated Node path makes that version available to noninteractive SSH/builds.
Run the packages step again after changing/removing the default Node version.
Volta is installed on macOS, but fnm's selected Node has PATH priority; the old
Volta shell plugin is not loaded. Global npm packages belong to the selected
Node version and are installed again when the LTS changes.

pnpm is installed through npm alongside fnm's default Node, ahead of old Volta
shims. Global npm installs explicitly target that Node's prefix, even if an old
npm configuration points elsewhere. Rerun `./install.sh --apply --only packages` and open a new
shell to repair an older setup where `node --version` and pnpm report different
Node versions. `command -v pnpm` should resolve under fnm's Node installation,
not `~/.volta/bin`.

The Debian npm profile includes `puppeteer-core`, paired with distro Chromium
(no separate browser download). Puppeteer Core requires an explicit
`executablePath: process.env.PUPPETEER_EXECUTABLE_PATH` when launching.
For project imports, install `puppeteer-core` in that project: Node does not
resolve global npm packages as project dependencies. Run as a non-root user;
the installer does not disable Chromium's sandbox.

## Editor and browser extensions

The editor manifest includes Bruno. The unpublished
[mermaid-jsdoc-viewer](https://github.com/g-ongenae/mermaid-jsdoc-viewer)
is built with npm from a pinned commit, packaged as a VSIX, and installed locally.
Update the commit in the manifest deliberately when you want a newer build.
VSCodium uses Open VSX; if an existing extension is unavailable there, the
installer reports it instead of changing the marketplace endpoint or silently
omitting it. Copilot is only selected for VS Code on macOS.

Browser installation needs confirmation in each browser. Open
`~/.config/dotfiles/browser-extensions.html` after the browsers step. It lists
uBlock Origin, SponsorBlock, Privacy Badger, PR Review Collector and GitHub
Mermaid JSDoc Viewer for Firefox/LibreWolf/Zen, plus Switchyard on Fedora;
the macOS page also has the two requested Chrome Web Store extensions.

`--firefox-policy` additionally resolves the real AMO IDs and generates
`~/.config/dotfiles/firefox-policies.json`. This optional policy is **not**
deployed automatically: native Firefox, LibreWolf, Zen and Flatpak builds have
different policy locations/support. Review and deploy it according to your
browser's enterprise-policy documentation. It uses `normal_installed`, leaving
users able to remove extensions. No browser profile is overwritten.

## Existing configuration and backups

Managed blocks preserve unrelated shell and Git settings. On the first shell
install, the installer asks for your name, email, and GitHub/GitLab/Bitbucket
usernames, then writes them to the ignored root file `.gitconfig.local` with
mode 0600. A generated include supplies that identity, the current checkout path,
and profile-specific defaults. The old Git-config symlink is converted to a
regular include file without changing its source.

Untouched copies of the previous Bash/Zsh startup templates migrate automatically.
The exact old Bash template also migrates when other tools appended settings or
an earlier installer surrounded it with managed blocks; those additions survive.
Customized legacy startup files or custom `ZDOTDIR` assignments stop the shell
step with an explanation; review and remove those old hooks before retrying.
The new setup uses standard `~/.zshenv` / `~/.zshrc` locations.

macOS installs Homebrew Bash and `bash-completion@2`, replacing the old conflicting
`bash-completion` formula. Open a new terminal and run `bash` to use it. Explicit
`/bin/bash` sessions still get environment and aliases, but skip modern prompt and
completion integrations that require Bash 4.2+. Completions load through their
framework entrypoint; individual files in `bash_completion.d` are never sourced
as a startup loop. Rerun `./install.sh --apply --only packages,shell` to migrate.

Before replacing existing content, the installer saves it under
`~/.local/share/dotfiles/backups/` with restrictive permissions. Names contain
the original home-relative path (slashes replaced by `__`) and a content hash.
Backups contain file content, not original symlink metadata. Restore a chosen
backup by copying its content back to the original path; remove managed blocks
to disconnect the checkout. Package installs are not undone by restoring files.

Keep personal shell additions in `~/.config/dotfiles/local.bash` or
`local.zsh`. Existing `zsh/secret/alias.zsh` and `secret/starship.toml` are
still loaded when present, but are never created or committed by the installer.

Upstream binaries are downloaded over HTTPS. GitHub SHA-256 digests or matching
checksum sidecars are verified when published; a missing checksum is explicitly
reported. Installed release tags, asset names and digests are recorded under
`~/.local/share/dotfiles/versions/`. Latest-release installs intentionally follow
upstream rather than a lockfile. Review the manifests before trusting any
third-party package source.

## Validation

```bash
python3 -m unittest discover -s tests -v
./install.sh --profile macos --dry-run
./install.sh --profile fedora --dry-run
./install.sh --profile debian-server --dry-run
```

Tests use temporary homes and mocked external installers. They check manifest
parsing, dry-run isolation, migration, backups, repeat runs, SSH environment,
browser selection and download verification. Full native installations still
need testing on disposable macOS/Fedora/Debian machines.

`dev {build|up|shell|ai|clean} [directory]` uses the chosen workspace; clean
targets only containers bearing that workspace's Dev Container label, never
unrelated images.

Package-source references:
[Vicinae](https://docs.vicinae.com/install/linux),
[Switchyard](https://github.com/alyraffauf/switchyard),
[GitHub Desktop for Linux](https://github.com/shiftkey/desktop),
[Proxyman Linux](https://github.com/ProxymanApp/proxyman-windows-linux),
[T3 Code](https://github.com/pingdotgg/t3code),
[Homebrew](https://brew.sh).
