# Commands and tools

What this repository gives you at a prompt once it is installed. Everything here
comes from `shell/interactive/` and `scripts/`; nothing in this list is needed by
scripts or noninteractive SSH commands.

- [Shell aliases](#shell-aliases)
- [Helper functions](#helper-functions)
- [Repository scripts](#repository-scripts)
- [Installed command-line tools](#installed-command-line-tools)

## Shell aliases

Every profile:

| Alias | Runs | Notes |
| --- | --- | --- |
| `g` | `git` | |
| `c` | `clear` | |
| `_` | `sudo` | |
| `n` | `npm` | |
| `nr` | `npm run` | |
| `reload` | `exec "$SHELL" -l` | restart the shell, picking up configuration changes |
| `ls` | `eza` | only when eza is installed |
| `la` | `eza --all --long` | only when eza is installed |
| `cat` | `bat`, or `batcat` on Debian | |
| `bat` | `batcat` | Debian only, where the executable has that name |
| `fd` | `fdfind` | Debian only, same reason |

macOS:

| Alias | Runs |
| --- | --- |
| `b` | `brew` |
| `p` | `pnpm`, as `nocorrect pnpm` under Zsh |
| `d` | `docker` |
| `ks` | `kubectl` |
| `vscode` | `code` |
| `local_ip` | `ipconfig getifaddr en0` |
| `rp` | `lsof -nP -iTCP -sTCP:LISTEN`, the listening TCP sockets |

Linux:

| Alias | Runs |
| --- | --- |
| `vscode` | `codium`, on Fedora |
| `local_ip` | `hostname -I` |
| `rp` | `ss -ltnp`, the listening TCP sockets |

macOS also loads kubectl's completion and [kube-ps1], which shows the current
cluster and namespace in the prompt. It starts switched off; turn it on with
`kubeon` and off again with `kubeoff`.

## Helper functions

These are functions rather than aliases, either because they take arguments or
because a completion has to be able to see them.

| Command | What it does |
| --- | --- |
| `root` | `cd` to the top of the current Git working tree |
| `nx …` | run the workspace-local `node_modules/.bin/nx`, found by searching upwards from the current directory, so it works from any package of a monorepo |
| `update_repos [-e a,b]` | update every Git repository below the current directory, optionally excluding some |
| `update_deps` | `./install.sh --update`, refreshing this machine's managed packages |
| `t3 …` | control a T3 Code service, locally or over SSH — see [t3.md](t3.md) |
| `dev …` | Dev Containers, macOS only — see below |
| `q` | quit the Terminal application, macOS only |

`nx` must stay a function: nx-completion runs `nx --help` from inside a
completion function, where aliases are invisible.

### Dev Containers

```bash
dev build [directory]    # build the workspace's dev container
dev up    [directory]    # start it
dev shell [directory]    # open a Zsh shell inside it
dev ai    [directory]    # run Claude Code inside it
dev clean [directory]    # remove this workspace's containers
```

The workspace defaults to the current directory. `clean` targets only containers
bearing that workspace's Dev Container label, never unrelated containers or
images.

### Wake-on-LAN

Debian installs `wakeonlan` and Fedora installs `wol` for sending magic packets;
macOS installs neither. Send one with `wakeonlan <MAC-address>` on Debian or
`wol <MAC-address>` on Fedora. Setting a machine up to *receive* them is covered
in [installer.md](installer.md#wake-on-lan).

## Repository scripts

Run these from the checkout. `t3`, `dev` and `update_repos` above are thin shell
wrappers around three of them.

| Script | Purpose |
| --- | --- |
| `./install.sh` | install or update this machine — see the [README](../README.md#install) |
| `./scripts/lint.sh [--fix]` | shfmt and ShellCheck over every shell file |
| `bash scripts/t3.sh …` | the script behind `t3`, usable on a host without this checkout |
| `bash scripts/print-pretty.sh '@b@green[[Done]]'` | echo with colour markup, for your own scripts |
| `python3 scripts/t3-service.py setup` | create the T3 Code user service; `t3 setup` calls this |
| `python3 scripts/t3-update.py` | update the T3 CLI and this machine's agents; `t3 update` calls this |
| `python3 scripts/wakeonlan.py` | re-enable Wake-on-LAN, run at boot by the systemd unit on Debian |

## Installed command-line tools

Beyond the aliases, every profile installs the same working set. The ones that
replace a system command are aliased above.

- **Files and search** — eza, bat, fd, ripgrep, fzf, skim, tree, cloc.
- **Prompt and history** — Starship, Atuin, zoxide, and the Zsh plugins.
- **Data** — jq (with its `alt+j` REPL widget), yq, yh, fx.
- **Git** — a current Git, git-lfs, git-delta, difftastic, gh, git-plus
  (`git multi`, behind `update_repos`).
- **Node** — fnm, pnpm, and the npm packages in
  `profiles/common/npm-packages.yaml`.
- **Shell quality** — ShellCheck, shfmt, hadolint.
- **Documentation** — tldr, and zsh-lovers saved under
  `~/.local/share/dotfiles/docs/`.
- **Agents** — Claude Code, Gemini CLI, Antigravity CLI, and Codex on Linux.

macOS adds the Kubernetes, cloud and container tooling; the Debian server adds
headless Chromium. Both are listed in [installer.md](installer.md).

[kube-ps1]: https://github.com/jonmosco/kube-ps1
