# Installer

Where each package comes from, what the installer does to the files you already
have, and what it deliberately leaves alone. For running it, see
[Install](../README.md#install) in the README.

- [Package choices](#package-choices)
- [Agents](#agents)
- [Tailscale](#tailscale)
- [macOS operations tools](#macos-operations-tools)
- [Where shared tools come from](#where-shared-tools-come-from)
- [Git](#git)
- [Node, fnm and pnpm](#node-fnm-and-pnpm)
- [SSH on macOS](#ssh-on-macos)
- [Headless Chromium on Debian](#headless-chromium-on-debian)
- [Wake-on-LAN](#wake-on-lan)
- [Browser routing on macOS](#browser-routing-on-macos)
- [Editor and browser extensions](#editor-and-browser-extensions)
- [Your existing configuration](#your-existing-configuration)
- [Backups](#backups)
- [Upstream binaries](#upstream-binaries)

## Package choices

| Component | macOS | Fedora | Debian server |
| --- | --- | --- | --- |
| Browser routing | [Finicky] | [Switchyard] (Flatpak) | — |
| Launcher | [Raycast] | [Vicinae] (COPR) | — |
| Browsers | [LibreWolf], [Firefox], [Zen], [Chrome], [Ungoogled Chromium] | [LibreWolf], [Firefox], [Zen] | [Chromium] for headless use |
| Editor | [VS Code] | [VSCodium] | [Vim] |
| Git GUI | [GitHub Desktop] | [shiftkey's GitHub Desktop] | — |
| Proxy inspector | [Proxyman] | [Proxyman AppImage] | — |
| Agents | [Claude Code], [Gemini CLI], [Antigravity CLI] | [Codex], [Claude Code], [Gemini CLI], [Antigravity CLI] | [Codex], [Claude Code], [Gemini CLI] |
| [Tailscale] | Standalone desktop app | Official stable RPM repository | Official stable APT repository |
| [T3 Code] | npm package | npm package | upstream AppImage |

The Fedora Flatpak list also contains [Apostrophe], [Buffer], [Drum Machine],
[Eloquent], [FocusWriter], [OBS Studio], [Sound Recorder], and [SSH Pilot].
[Flameshot] comes from dnf. Switchyard needs first-run routing setup and
selection as the default browser.

## Agents

Gemini CLI uses the
[official npm package](https://geminicli.com/docs/get-started/installation/)
with fnm's Node on every profile.

Antigravity CLI uses the native release manifest published through Google's
[official installer](https://antigravity.google/cli/install.sh) on every
profile. It verifies the release's SHA-512 checksum and installs `agy` under
`~/.local/bin`, without invoking upstream's shell-profile editing step. Run
`agy` to start the CLI; agent sign-in remains a manual first-run step.

## Tailscale

Tailscale uses the `tailscale-app` [Homebrew] cask on macOS and the
[official stable repositories](https://pkgs.tailscale.com/stable/) on Linux.

Linux enables `tailscaled` after installation; it does not run `tailscale up`,
enable Tailscale SSH, or configure routes. Join the tailnet yourself by opening
the Tailscale app on macOS or running `sudo tailscale up` on Linux.

The Debian repository key is scoped with `signed-by`, and Fedora uses upstream's
signed repository metadata configuration.

The `t3` helper shares a T3 Code service over Tailscale Serve; see
[t3.md](t3.md).

## macOS operations tools

macOS additionally installs Google Cloud, Kubernetes, Terraform, Helm,
Telepresence, minikube, Wireshark, macFUSE, Docker Desktop, Insomnia, Volta, and
Dev Container CLI tools. Approve applications, system extensions, licenses, and
any debugger code-signing prompts yourself.

The Brewfile explicitly trusts the Telepresence, HashiCorp, Multi-Gitter and
MongoDB taps using Homebrew's
[`trusted: true` declarations](https://docs.brew.sh/Brew-Bundle-and-Brewfile#trusted).
The latter two are declared so `brew upgrade` can handle an installation you
already have; their packages and database services are not added automatically.

After Homebrew installation/upgrades, the macOS packages step removes
`com.apple.quarantine` from `/Applications/LibreWolf.app`, following the
[LibreWolf first-launch fix](https://librewolf.net/docs/faq/#why-is-librewolf-marked-as-broken).
This also repairs an existing installation when rerun. If you installed
LibreWolf in a custom application directory, apply
`xattr -dr com.apple.quarantine` to that app's path yourself.

## Where shared tools come from

Shared tools use native package managers where appropriate, plus upstream Linux
releases for Starship, Atuin, eza, difftastic, skim, zoxide, fnm, uv, hadolint
and yq. Linux yh and shfmt use Go; git-plus and tldr use isolated uv tool
environments; fx uses npm. Linux zsh-completions comes from its upstream
repository and zsh-lovers is saved as HTML under `~/.local/share/dotfiles/docs/`.

Name mappings and exceptions:

- `delta` / `git-delta`, `sk` / skim, and `kubectl` / `kubernetes-cli` are
  single tools, not duplicate installations.
- Linux supplies GNU sed, grep, patch, awk, which, watch and base64 through the
  distro packages. macOS installs GNU variants; shell PATH exposes their
  unprefixed names where Homebrew provides a `gnubin` directory.
- Debian names bat and fd executables `batcat` and `fdfind`; interactive aliases
  provide `bat` and `fd`. Scripts should use the distro executable names.

## Git

Git is upgraded through Homebrew on macOS. On Linux the installer resolves the
latest stable upstream Git tag and builds it under `~/.local`, ahead of the
distro Git in PATH. It requires compiler/development packages and can take a few
minutes. It does not replace `/usr/bin/git` or build documentation.

## Node, fnm and pnpm

fnm installs the latest Node LTS and selects it as default on every profile. A
generated Node path makes that version available to noninteractive SSH/builds.
Run the packages step again after changing/removing the default Node version.

Volta is installed on macOS, but fnm's selected Node has PATH priority, and
Volta's Zsh completion comes from brew's own `_volta` through `fpath`. Global
npm packages belong to the selected Node version and are installed again when
the LTS changes.

pnpm is installed through npm alongside fnm's default Node. Global npm installs
explicitly target that Node's prefix, whatever an existing npm configuration
points at, so `command -v pnpm` resolves under fnm's Node installation. If
`node --version` and pnpm ever disagree, rerun
`./install.sh --apply --only packages` and open a new shell.

## SSH on macOS

macOS uses Apple's `/usr/bin/ssh` and `/usr/bin/ssh-add` so `UseKeychain`
settings work. After package upgrades, the packages step unlinks any Homebrew
OpenSSH so it cannot shadow them. SSH configuration and keys are preserved.

If a Homebrew SSH client is still in the way when you pull, run this from the
checkout on your Mac:

```bash
GIT_SSH_COMMAND=/usr/bin/ssh git pull --ff-only
./install.sh --apply --only packages,shell
```

Open a new terminal afterward; `command -v ssh` should show `/usr/bin/ssh`.

## Headless Chromium on Debian

The Debian npm profile includes `puppeteer-core`, paired with distro Chromium
(no separate browser download). Puppeteer Core requires an explicit
`executablePath: process.env.PUPPETEER_EXECUTABLE_PATH` when launching; the
server profile exports that variable.

For project imports, install `puppeteer-core` in that project: Node does not
resolve global npm packages as project dependencies. Run as a non-root user; the
installer does not disable Chromium's sandbox.

## Wake-on-LAN

Debian installs `wakeonlan` for sending magic packets and enables wake on
supported physical Ethernet adapters with `ethtool`. The
`dotfiles-wakeonlan.service` unit reapplies this after networking starts at
boot; it does not restart networking.

Check the results with:

```bash
journalctl -u dotfiles-wakeonlan.service
sudo ethtool <interface>            # look for `Wake-on: g`
```

Firmware/BIOS must also permit Wake-on-LAN, and the machine must retain Ethernet
power while asleep/off. If a network manager later resets the setting, rerun
`sudo systemctl start dotfiles-wakeonlan.service`.

Fedora installs only the `wol` sender; macOS skips Wake-on-LAN setup.

## Browser routing on macOS

The shell step copies `apps/finicky.template.js` to `~/.finicky.js`, which
[Finicky] reads to decide which browser opens a given link. Edit the template in
the checkout and rerun `./install.sh --apply --only shell` to change the rules;
editing `~/.finicky.js` directly means the next run replaces your edits, after
saving them to the backup directory.

## Editor and browser extensions

The editor manifest includes Bruno. The unpublished
[mermaid-jsdoc-viewer](https://github.com/g-ongenae/mermaid-jsdoc-viewer) is
built with npm from a pinned commit, packaged as a VSIX, and installed locally.
Update the commit in the manifest deliberately when you want a newer build.

VSCodium uses Open VSX; if an existing extension is unavailable there, the
installer reports it instead of changing the marketplace endpoint or silently
omitting it. Copilot is only selected for VS Code on macOS.

Browser installation needs confirmation in each browser. Open
`~/.config/dotfiles/browser-extensions.html` after the browsers step. It lists
uBlock Origin, SponsorBlock, Privacy Badger, PR Review Collector and GitHub
Mermaid JSDoc Viewer for Firefox/LibreWolf/Zen, plus Switchyard on Fedora; the
macOS page also has two Chrome Web Store extensions.

`--firefox-policy` additionally resolves the real AMO IDs and generates
`~/.config/dotfiles/firefox-policies.json`. This optional policy is **not**
deployed automatically: native Firefox, LibreWolf, Zen and Flatpak builds have
different policy locations/support. Review and deploy it according to your
browser's enterprise-policy documentation. It uses `normal_installed`, leaving
users able to remove extensions. No browser profile is overwritten.

## Your existing configuration

### Git identity

Managed blocks preserve unrelated shell and Git settings. On the first shell
install, the installer asks for your name, email, and GitHub/GitLab/Bitbucket
usernames, then writes them to the ignored root file `.gitconfig.local` with
mode 0600.

A generated include supplies that identity, the current checkout path, and
profile-specific defaults. A Git-config symlink found in its place is converted
to a regular include file without changing its source.

### Your startup files

Managed startup files live at the standard `~/.bashrc`, `~/.zshenv` and
`~/.zshrc` locations, where the installer adds its managed blocks and leaves
everything else alone. An untouched stock Zsh template is migrated
automatically.

A startup file carrying a custom `ZDOTDIR` assignment, or the startup files of
the installer this one replaced, stop the shell step with an explanation
instead. Back those up and remove the old settings by hand before retrying.

macOS installs Homebrew Bash and `bash-completion@2`, which replaces the
conflicting `bash-completion` formula. Open a new terminal and run `bash` to use
it. Explicit `/bin/bash` sessions still get environment and aliases, but skip
modern prompt and completion integrations that require Bash 4.2+. Completions
load through their framework entrypoint; individual files in
`bash_completion.d` are never sourced as a startup loop.

### Keeping your own additions

Keep personal shell additions in `~/.config/dotfiles/local.bash` or `local.zsh`.
`zsh/secret/alias.zsh` and `secret/starship.toml` are loaded when present, but
are never created or committed by the installer.

## Backups

Before replacing existing content, the installer saves it under
`~/.local/share/dotfiles/backups/` with restrictive permissions. Names contain
the original home-relative path (slashes replaced by `__`) and a content hash.

Backups contain file content, not original symlink metadata. Restore a chosen
backup by copying its content back to the original path; remove managed blocks
to disconnect the checkout. Package installs are not undone by restoring files.

## Upstream binaries

Upstream binaries are downloaded over HTTPS. GitHub SHA-256 digests or matching
checksum sidecars are verified when published; a missing checksum is explicitly
reported. Installed release tags, asset names and digests are recorded under
`~/.local/share/dotfiles/versions/`. Latest-release installs intentionally
follow upstream rather than a lockfile. Review the manifests before trusting any
third-party package source.

<!-- Links -->

[Antigravity CLI]: https://antigravity.google/
[Apostrophe]: https://gitlab.gnome.org/World/apostrophe
[Buffer]: https://gitlab.gnome.org/cheywood/buffer
[Chrome]: https://www.google.com/chrome/
[Chromium]: https://www.chromium.org/chromium-projects/
[Claude Code]: https://claude.com/fr/product/claude-code
[Codex]: https://openai.com/fr-FR/codex/
[Drum Machine]: https://github.com/Revisto/drum-machine
[Eloquent]: https://github.com/sonnyp/Eloquent
[Finicky]: https://github.com/johnste/finicky
[Firefox]: https://www.firefox.com/
[Flameshot]: https://github.com/flameshot-org/flameshot/
[FocusWriter]: https://gottcode.org/focuswriter/
[Gemini CLI]: https://geminicli.com/
[GitHub Desktop]: https://github.com/apps/desktop
[Homebrew]: https://brew.sh
[LibreWolf]: https://librewolf.net/
[OBS Studio]: https://github.com/obsproject/obs-studio
[Proxyman]: https://proxyman.com/
[Proxyman AppImage]: https://github.com/ProxymanApp/proxyman-windows-linux
[Raycast]: https://www.raycast.com/
[shiftkey's GitHub Desktop]: https://github.com/shiftkey/desktop
[Sound Recorder]: https://gitlab.gnome.org/World/vocalis
[SSH Pilot]: https://github.com/mfat/sshpilot
[Switchyard]: https://github.com/alyraffauf/switchyard
[T3 Code]: https://github.com/pingdotgg/t3code
[Tailscale]: https://tailscale.com/
[Ungoogled Chromium]: https://ungoogled-software.github.io/
[Vicinae]: https://www.vicinae.com
[Vim]: https://www.vim.org/
[VS Code]: https://code.visualstudio.com/
[VSCodium]: https://vscodium.com/
[Zen]: https://zen-browser.app/
