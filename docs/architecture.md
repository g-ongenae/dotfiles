# Architecture

How the repository is laid out, how the shell files decide what to load, and how
to check that both still work.

- [Layout](#layout)
- [Manifests](#manifests)
- [How the shell files load](#how-the-shell-files-load)
- [Zsh plugins](#zsh-plugins)
- [Validation](#validation)

## Layout

```text
install.sh                   # ensures Python 3, then runs scripts/install.py
apps/
  finicky.template.js        # macOS browser routing, copied to ~/.finicky.js
docs/                        # this documentation
git/
  .gitconfig                 # shared Git configuration, pulled in by a generated include
  .gitignore_global
  .git-blame-ignore-revs
profiles/
  common/
    packages.yaml            # shared non-native providers and agent selection
    npm-packages.yaml
    vscode-extension.yaml
    browser-extensions.yaml
    unduck-backup.json       # Unduck bangs, imported into each browser
  macos/
    Brewfile
  fedora/
    packages.yaml
  debian-server/
    packages.yaml
    dotfiles-wakeonlan.service
shell/
  common/                    # silent environment for Bash and Zsh
  interactive/               # prompt-only integrations and shared aliases
  macos/                     # Homebrew paths and Mac-specific commands
  linux/                     # Linux paths and network commands
  server/                    # terminal editor and headless Chromium environment
scripts/
  install.py                 # standard-library installer behind install.sh
  t3-service.py              # creates and controls the T3 Code user service
  wakeonlan.py               # re-enables Wake-on-LAN on Debian at boot
  t3.sh                      # T3 Code service control, local or over SSH
  devcontainer.sh            # the `dev` helper
  update-repos.sh            # the `update_repos` helper
  print-pretty.sh            # colour markup for shell output
  lint.sh                    # shfmt and ShellCheck over every shell file
secret/                      # starship.toml, when you keep one here
zsh/
  plugins/                   # pinned plugin submodules
  secret/                    # alias.zsh, when you keep one here
tests/
  test_install.py
  test_t3.py
  test_wakeonlan.py
```

`secret/` and `zsh/secret/` are committed empty on purpose: their `.gitignore`
keeps everything you put there out of Git. `run/` holds Zsh runtime files and is
not tracked at all.

## Manifests

Packages live under `profiles/`, including provider/source selection.

YAML files deliberately use a small subset: top-level sections containing
two-space-indented lists of strings. Quote strings containing `: ` or ` #`;
nested objects, anchors and inline comments are rejected. No PyYAML bootstrap is
needed.

## How the shell files load

The split is between what a _person_ needs and what a _process_ needs.

`shell/interactive/` holds anything needed by a person at a prompt: aliases,
completion, keybindings, history, Starship, Atuin, fzf, zoxide, and fnm's
directory-change integration. An interactive SSH session gets these too;
“interactive” does not mean “desktop.”

`shell/common/` holds the environment variables and PATH setup needed by
scripts, builds, and noninteractive SSH commands. It runs no external commands
and prints nothing, so it cannot corrupt the output of a remote command.

Load order:

- **Bash** — the managed block goes before the usual noninteractive `.bashrc`
  early return; prompt setup goes after the user's existing configuration.
- **Zsh** — `.zshenv` loads the common environment, `.zshrc` the prompt.
- **Scripts** — ordinary noninteractive Bash scripts inherit their parent's
  environment; no global `BASH_ENV` hook is installed.

Commands run by a coding agent (Claude Code, Codex or Gemini CLI, detected
through `CLAUDECODE`, `CODEX_THREAD_ID`, `CODEX_SANDBOX` or `GEMINI_CLI`) set
`DOTFILES_AGENT=1`. They then get no pager, colour or Git credential prompt, a
plain prompt, and none of Starship, Atuin, zoxide, the Zsh plugins or the
`eza`/`bat` aliases.

Each profile then adds its own layer: `shell/macos/`, `shell/linux/` and, for
the Debian server, `shell/server/`. All profiles use Vim as the shell's terminal
editor. Git uses VS Code on macOS, VSCodium on Fedora, and Vim on the server.
Linux `ip` is left intact. No uninstalled macOS locale is forced onto Linux.

## Zsh plugins

`zsh/plugins/` holds pinned submodules: autosuggestions, syntax highlighting,
nx-completion and jq. Adding one means cloning it as a submodule there and
naming it in two places:

1. the loop in `shell/interactive/init.zsh`, which documents how an entrypoint
   is found and what each plugin needs;
2. the `git submodule update --init` call in `scripts/install.py`.

## Validation

### Linting and formatting

```bash
./scripts/lint.sh          # report formatting differences and lint findings
./scripts/lint.sh --fix    # reformat in place, then report what is left
```

`scripts/lint.sh` covers every file in the repository, tracked or newly added,
except the vendored plugins under `zsh/plugins/`, which belong to their
upstreams. [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) runs
the same script on every push and pull request.

#### Shell files

- **Formatting** comes from [shfmt](https://github.com/mvdan/sh), configured by
  the `[*.{sh,bash,zsh}]` section of `.editorconfig`, so editors with
  EditorConfig support produce the same layout.
- **Linting** comes from [ShellCheck](https://www.shellcheck.net), configured by
  `.shellcheckrc`. Files without a shebang declare their dialect on their first
  line with `# shellcheck shell=...`. Zsh files are formatted but not linted,
  because ShellCheck has no Zsh dialect.

Both tools are installed by every profile.

#### Python files

[Ruff](https://docs.astral.sh/ruff/) lints and formats them, configured by
`ruff.toml`: its default rules, single quotes and lines of up to 120
characters. `scripts/lint.sh` runs it through `uvx` at a pinned version; every
profile installs uv. The configuration targets Python 3.9, which is what a
fresh Mac runs the installer with.

#### Markdown, YAML, JSON and JavaScript

[Prettier](https://prettier.io) formats them, configured by `.prettierrc.json`:
single quotes and lines of up to 120 characters. `scripts/lint.sh` runs it
through `npx` at a pinned version, so the repository has no `package.json` and
nothing to install beyond Node.

### Installer

```bash
python3 -m unittest discover -s tests -v
./install.sh --profile macos --dry-run
./install.sh --profile fedora --dry-run
./install.sh --profile debian-server --dry-run
```

Tests use temporary homes and mocked external installers. They check manifest
parsing, dry-run isolation, migration, backups, repeat runs, SSH environment,
browser selection and download verification. The same workflow runs them on
Linux with Python 3.9 and the latest Python. Full native installations still
need testing on disposable macOS/Fedora/Debian machines.
