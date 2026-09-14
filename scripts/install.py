#!/usr/bin/env python3
"""Profile installer. Standard library only; dry runs never write or use the network."""
import argparse
import ast
import fnmatch
import hashlib
import html
import json
import os
from pathlib import Path
import platform
import re
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
PROFILES = ('macos', 'fedora', 'debian-server')
STEPS = ('packages', 'shell', 'extensions', 'browsers')
# Untouched copies of the previous installer templates can migrate safely.
LEGACY_HASHES = {
    '.bashrc': 'a50fed172dd7df8e977d233d1f4ffaa6dc1033b23636261c980cc5357471e053',
    '.bash_profile': 'a50fed172dd7df8e977d233d1f4ffaa6dc1033b23636261c980cc5357471e053',
    '.zshenv': 'd87ed002bb307efb306258142714c1d66e332dd1b651ca317d25eafb42dddb5f',
}


def manifest(path):
    """Read our YAML subset: top-level sections containing string lists.

    Reject unsupported YAML instead of silently misreading it. No YAML runtime
    needs to be installed merely to preview the packages on a fresh machine.
    """
    result, section = {}, None
    for number, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        if re.fullmatch(r'[a-z][a-z0-9-]*:', line):
            section = line[:-1]
            if section in result:
                raise ValueError(f'{path}:{number}: duplicate section')
            result[section] = []
        elif line.startswith('  - ') and section:
            value = line[4:]
            if value.startswith(('"', "'")):
                value = ast.literal_eval(value)
            elif ': ' in value or ' #' in value or value.startswith(('[', '{', '&', '*', '!')):
                raise ValueError(f'{path}:{number}: quote this string')
            if not isinstance(value, str) or not value:
                raise ValueError(f'{path}:{number}: expected a nonempty string')
            result[section].append(value)
        else:
            raise ValueError(f'{path}:{number}: expected section: or two-space-indented - string')
    return result


def detect_profile():
    if sys.platform == 'darwin':
        return 'macos'
    release = Path('/etc/os-release')
    values = dict(re.findall(r'^(\w+)=(.*)$', release.read_text(), re.M)) if release.exists() else {}
    distro = values.get('ID', '').strip('"')
    if distro == 'fedora':
        return 'fedora'
    if distro == 'debian' and values.get('VERSION_ID', '').strip('"') == '13':
        return 'debian-server'
    return None


def fetch(url):
    if not url.startswith('https://'):
        raise ValueError('Downloads must use HTTPS')
    request = urllib.request.Request(url, headers={'User-Agent': 'dotfiles-profile-installer'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def extract_binary(path, name):
    """Read just the requested regular file; never extract archive paths or links."""
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            entries = [p for p in archive.infolist() if Path(p.filename).name == name and not p.is_dir()]
            if len(entries) == 1:
                return archive.read(entries[0])
    elif tarfile.is_tarfile(path):
        with tarfile.open(path) as archive:
            entries = [p for p in archive.getmembers() if p.isfile() and Path(p.name).name == name]
            if len(entries) == 1:
                return archive.extractfile(entries[0]).read()
    else:
        return path.read_bytes()
    raise ValueError(f'Expected exactly one {name} binary in {path.name}')


def migrate_startup(filename, text):
    if filename in ('.bashrc', '.bash_profile'):
        # The old installer symlinked this template. Other tools often appended
        # startup snippets, defeating the whole-file hash check. Remove only
        # the exact known template and preserve additions and managed blocks.
        legacy = (ROOT / 'scripts/legacy/bash_profile.bash').read_text().rstrip()
        text = text.replace(legacy, '')
    if hashlib.sha256(text.encode()).hexdigest() == LEGACY_HASHES.get(filename):
        return ''
    return text


class Installer:
    def __init__(self, args):
        self.args = args
        self.home = args.home.expanduser().resolve()
        self.config = self.home / '.config/dotfiles'
        self.data = self.home / '.local/share/dotfiles'
        self.bin = self.home / '.local/bin'
        self.identity = ROOT / '.gitconfig.local'
        self.common = manifest(ROOT / 'profiles/common/packages.yaml')
        self.profile = {} if args.profile == 'macos' else manifest(ROOT / f'profiles/{args.profile}/packages.yaml')
        self.env = os.environ.copy()
        # Set HOME only in child-process environments; never alter the agent's environment.
        self.env['HOME'] = str(self.home)
        self.env['PATH'] = str(self.bin) + os.pathsep + self.env.get('PATH', '/usr/bin:/bin')
        if args.profile == 'macos':
            self.env['PATH'] += ':/opt/homebrew/bin:/usr/local/bin:/Applications/Visual Studio Code.app/Contents/Resources/app/bin'
        self.env['FNM_DIR'] = str(self.home / '.local/share/fnm')
        self.env['PATH'] += os.pathsep + self.env['FNM_DIR']
        self.failures = []

    def run(self, *argv, cwd=None, capture=False, env=None):
        argv = [str(x) for x in argv]
        print('+ ' + shlex.join(argv), flush=True)
        if not self.args.apply:
            return ''
        return subprocess.run(argv, cwd=cwd, env=env or self.env, check=True,
                              stdout=subprocess.PIPE if capture else None,
                              text=True).stdout or ''

    def sudo(self, *argv):
        return self.run('sudo', *argv)

    def write(self, path, content, executable=False):
        content = content.encode() if isinstance(content, str) else content
        if path.is_file() and not path.is_symlink() and path.read_bytes() == content:
            return
        print(f'Write {path}' + (' (backup existing file)' if path.exists() or path.is_symlink() else ''))
        if not self.args.apply:
            return
        if path.exists() or path.is_symlink():
            if path.is_dir():
                raise ValueError(f'Refusing to replace directory {path}')
            old = path.read_bytes() if path.exists() else str(path.readlink()).encode()
            digest = hashlib.sha256(old).hexdigest()[:16]
            try:
                backup_name = str(path.relative_to(self.home)).replace('/', '__')
            except ValueError:
                backup_name = 'external__' + hashlib.sha256(str(path).encode()).hexdigest()[:16]
            backup = self.data / 'backups' / (backup_name + '.' + digest)
            backup.parent.mkdir(parents=True, exist_ok=True)
            if not backup.exists():
                backup.write_bytes(old)
                backup.chmod(0o600)
            print(f'  Backup: {backup}')
        path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            stream.write(content)
            temporary = Path(stream.name)
        temporary.chmod(0o755 if executable else 0o600)
        temporary.replace(path)  # replaces a symlink, never its target

    def hook(self, path, body, prepend=False, label='managed'):
        start, end = f'# >>> dotfiles {label} >>>', f'# <<< dotfiles {label} <<<'
        text = path.read_text() if path.exists() else ''
        text = migrate_startup(path.name, text)  # write() backs up the original
        if text.count(start) != text.count(end) or text.count(start) > 1:
            raise ValueError(f'Malformed managed block in {path}; refusing to overwrite')
        if start in text:
            text = re.sub(re.escape(start) + r'.*?' + re.escape(end) + r'\n?', '', text, flags=re.S)
        block = start + '\n' + body.rstrip() + '\n' + end + '\n'
        self.write(path, block + text if prepend else text.rstrip() + '\n' + block)

    def preflight_shell(self):
        for filename in ('.zshenv', '.bashrc', '.bash_profile'):
            path = self.home / filename
            if not path.exists():
                continue
            text = migrate_startup(filename, path.read_text())
            if re.search(r'^[^#\n]*(?:ZDOTDIR\s*=|/(?:run|system)/(?:\{?env|alias|\.zshrc)|CURRENT_SCRIPT=\$BASH_SOURCE|for completion_file in)', text, re.M):
                raise ValueError(f'{path} has customized legacy startup/ZDOTDIR settings. Back it up and remove those settings before applying the shell step.')

    def ensure_identity(self):
        fields = (
            ('user.name', 'Name'),
            ('user.email', 'Email'),
            ('github.user', 'GitHub username'),
            ('gitlab.user', 'GitLab username'),
            ('bitbucket.user', 'Bitbucket username'),
        )
        if self.identity.exists():
            missing = []
            for key, _ in fields:
                result = subprocess.run(('git', 'config', '--file', str(self.identity), '--get', key),
                                        env=self.env, capture_output=True, text=True)
                if result.returncode or not result.stdout.strip():
                    missing.append(key)
            if missing:
                raise ValueError(f'{self.identity} is missing: {", ".join(missing)}')
            if self.args.apply and not self.identity.is_symlink():
                self.identity.chmod(0o600)
            return
        print(f'Create private Git identity: {self.identity}')
        if not self.args.apply:
            return
        if not sys.stdin.isatty():
            raise ValueError(f'{self.identity} is missing; run the shell step from an interactive terminal to create it')
        values = {}
        for key, label in fields:
            current = subprocess.run(('git', 'config', '--global', '--get', key), env=self.env,
                                     capture_output=True, text=True).stdout.strip()
            prompt = f'{label}' + (f' [{current}]' if current else '') + ': '
            value = input(prompt).strip() or current
            if not value or '\n' in value or '\r' in value:
                raise ValueError(f'{label} cannot be empty or contain a newline')
            values[key] = value
        content = (
            '[user]\n'
            f'  name = {json.dumps(values["user.name"], ensure_ascii=False)}\n'
            f'  email = {json.dumps(values["user.email"], ensure_ascii=False)}\n\n'
            '[github]\n'
            f'  user = {json.dumps(values["github.user"], ensure_ascii=False)}\n\n'
            '[gitlab]\n'
            f'  user = {json.dumps(values["gitlab.user"], ensure_ascii=False)}\n\n'
            '[bitbucket]\n'
            f'  user = {json.dumps(values["bitbucket.user"], ensure_ascii=False)}\n'
        )
        self.write(self.identity, content)

    def release(self, spec, kind='binary'):
        repo, name, pattern = shlex.split(spec)
        arch = platform.machine()
        arch = {'arm64': 'aarch64', 'amd64': 'x86_64'}.get(arch, arch)
        if arch not in ('x86_64', 'aarch64'):
            raise ValueError(f'Unsupported release architecture: {arch}')
        if name in ('proxyman', 't3-code') and arch != 'x86_64':
            raise ValueError(f'{name} does not publish an ARM Linux AppImage')
        pattern = pattern.format(arch=arch, arm='arm64' if arch == 'aarch64' else arch,
                                 debarch='arm64' if arch == 'aarch64' else 'amd64',
                                 fnm='arm64' if arch == 'aarch64' else 'linux')
        print(f'Latest release: {repo} / {pattern} -> {name} ({kind})')
        if not self.args.apply:
            return
        release = json.loads(fetch(f'https://api.github.com/repos/{repo}/releases/latest'))
        assets = release['assets']
        matches = [a for a in assets if fnmatch.fnmatchcase(a['name'], pattern)]
        if len(matches) != 1:
            raise ValueError(f'{repo}: expected one asset matching {pattern}, found {len(matches)}')
        asset = matches[0]
        content = fetch(asset['browser_download_url'])
        digest = asset.get('digest') or ''
        expected = digest.removeprefix('sha256:') if digest.startswith('sha256:') else ''
        checksum = next((a for a in assets if a['name'] == asset['name'] + '.sha256'), None)
        if not expected and checksum:
            expected = fetch(checksum['browser_download_url']).decode().split()[0]
        actual = hashlib.sha256(content).hexdigest()
        if expected and actual != expected:
            raise ValueError(f'Checksum mismatch for {repo}/{asset["name"]}')
        if not expected:
            print(f'  No upstream SHA-256 provided; HTTPS download SHA-256: {actual}')
        with tempfile.TemporaryDirectory(prefix='dotfiles-release-') as directory:
            path = Path(directory) / asset['name']
            path.write_bytes(content)
            if kind == 'rpm':
                self.sudo('dnf', 'install', '-y', path)
            elif kind == 'appimage':
                self.write(self.bin / name, content, executable=True)
                self.write(self.home / '.local/share/applications' / f'{name}.desktop',
                           f'[Desktop Entry]\nType=Application\nName=Proxyman\nExec="{self.bin / name}" %U\nTerminal=false\nCategories=Development;\n')
            else:
                self.write(self.bin / name, extract_binary(path, name), executable=True)
                if name == 'uv':
                    self.write(self.bin / 'uvx', extract_binary(path, 'uvx'), executable=True)
        self.write(self.data / 'versions' / (repo.replace('/', '__') + '.json'),
                   json.dumps({'tag': release['tag_name'], 'asset': asset['name'], 'sha256': actual}, indent=2) + '\n')

    def source_tool(self, tool):
        print(f'Install source tool: {tool}')
        if not self.args.apply:
            return
        if tool == 'zsh-completions':
            dest = self.data / 'zsh-completions'
            if dest.exists():
                self.run('git', '-C', dest, 'pull', '--ff-only')
            else:
                self.run('git', 'clone', '--depth=1', 'https://github.com/zsh-users/zsh-completions.git', dest)
        elif tool == 'zsh-lovers':
            self.write(self.data / 'docs/zsh-lovers.html', fetch('https://grml.org/zsh/zsh-lovers.html'))
        elif tool == 'git-latest':
            refs = self.run('git', 'ls-remote', '--tags', 'https://github.com/git/git.git', capture=True)
            tags = re.findall(r'refs/tags/(v\d+\.\d+\.\d+)$', refs, re.M)
            if not tags:
                raise ValueError('Cannot resolve latest stable Git tag')
            tag = max(tags, key=lambda s: tuple(map(int, s[1:].split('.'))))
            current = subprocess.run([str(self.bin / 'git'), '--version'], capture_output=True, text=True).stdout.strip() if (self.bin / 'git').exists() else ''
            if current == 'git version ' + tag[1:]:
                return
            with tempfile.TemporaryDirectory(prefix='dotfiles-git-') as directory:
                self.run('git', 'clone', '--depth=1', '--branch', tag, 'https://github.com/git/git.git', directory)
                self.run('make', f'-j{min(os.cpu_count() or 2, 8)}', f'prefix={self.home / ".local"}', 'all', cwd=directory)
                self.run('make', f'prefix={self.home / ".local"}', 'install', cwd=directory)
        else:
            raise ValueError(f'Unknown source tool {tool}')

    def node(self):
        self.run('fnm', 'install', '--lts')
        self.run('fnm', 'default', 'lts-latest')
        if self.args.apply:
            # fnm exec's child gets the selected Node without shell eval.
            output = self.run('fnm', 'exec', '--log-level=quiet', '--using=lts-latest', 'node', '-p', 'process.execPath', capture=True)
            self.env['PATH'] = str(Path(output.strip()).parent) + os.pathsep + self.env['PATH']
            # Keep global tools with fnm even if an old npmrc/manager overrides
            # npm's prefix; otherwise pnpm can still fall through to Volta.
            self.env['npm_config_prefix'] = str(Path(output.strip()).parent.parent)
            self.env.pop('NPM_CONFIG_PREFIX', None)
            self.write(self.config / 'node-path.sh', 'dotfiles_prepend_path ' + shlex.quote(str(Path(output.strip()).parent)) + '\n')
        packages = manifest(ROOT / 'profiles/common/npm-packages.yaml')
        selected = packages['common'] + packages.get(self.args.profile, [])
        self.run('npm', 'install', '--global', *selected)
        agents = self.common['agents'] + self.common.get(self.args.profile + '-agents', [])
        if 'claude' in agents:
            # Native installer, downloaded to disk and run only in --apply mode.
            print('Install Claude Code: https://claude.ai/install.sh (stable)')
            if self.args.apply:
                with tempfile.TemporaryDirectory(prefix='dotfiles-claude-') as directory:
                    installer = Path(directory) / 'install.sh'
                    installer.write_bytes(fetch('https://claude.ai/install.sh'))
                    self.run('bash', installer, 'stable')
        if 'codex' in agents:
            self.run('npm', 'install', '--global', '@openai/codex')

    def packages(self):
        if self.args.profile == 'macos':
            brew = shutil.which('brew')
            if not brew:
                brew = next((p for p in ('/opt/homebrew/bin/brew', '/usr/local/bin/brew') if Path(p).exists()), None)
            if not brew:
                if self.args.apply:
                    raise ValueError('Install Homebrew from https://brew.sh first, then rerun.')
                brew = 'brew'
            self.env['PATH'] = str(Path(brew).parent) + os.pathsep + self.env['PATH']
            self.run(brew, 'update')
            self.run(brew, 'bundle', '--file', ROOT / 'profiles/macos/Brewfile')
            if getattr(self.args, 'update', False):
                self.run(brew, 'upgrade')
                self.run(brew, 'cleanup')
            else:
                self.run(brew, 'upgrade', 'git')
            # LibreWolf's unsigned macOS build otherwise appears damaged on
            # first launch. Also repair already-installed copies on reruns.
            # https://librewolf.net/docs/faq/#why-is-librewolf-marked-as-broken
            if not self.args.apply or Path('/Applications/LibreWolf.app').is_dir():
                self.run('/usr/bin/xattr', '-dr', 'com.apple.quarantine', '/Applications/LibreWolf.app')
            self.env['PATH'] = '/Applications/Visual Studio Code.app/Contents/Resources/app/bin:' + self.env['PATH']
        else:
            manager = 'apt-get' if self.args.profile == 'debian-server' else 'dnf'
            self.sudo(manager, 'update' if manager == 'apt-get' else 'makecache')
            self.sudo(manager, 'install', '-y', *self.profile['native'])
            if self.args.profile == 'debian-server':
                self.sudo('install', '-D', '-m', '755', ROOT / 'scripts/wakeonlan.py',
                          '/usr/local/libexec/dotfiles-wakeonlan.py')
                self.sudo('install', '-m', '644', ROOT / 'profiles/debian-server/dotfiles-wakeonlan.service',
                          '/etc/systemd/system/dotfiles-wakeonlan.service')
                self.sudo('systemctl', 'daemon-reload')
                self.sudo('systemctl', 'enable', '--now', 'dotfiles-wakeonlan.service')
            if self.args.profile == 'fedora':
                for repo in sorted((ROOT / 'profiles/fedora').glob('*.repo')):
                    self.sudo('install', '-m', '644', repo, '/etc/yum.repos.d/' + repo.name)
                if self.profile.get('vendor-packages'):
                    self.sudo('dnf', 'install', '--refresh', '-y', *self.profile['vendor-packages'])
            for spec in self.common['linux-releases']:
                self.release(spec)
            for spec in self.profile.get('binary-releases', []):
                self.release(spec)
            for spec in self.common['linux-go']:
                env = dict(self.env, GOBIN=str(self.bin))
                self.run('go', 'install', spec, env=env)
            for tool in self.common['linux-source']:
                self.source_tool(tool)
            for copr in self.profile.get('copr', []):
                self.sudo('dnf', 'copr', 'enable', '-y', copr)
            if self.profile.get('copr-packages'):
                self.sudo('dnf', 'install', '-y', *self.profile['copr-packages'])
            for spec in self.profile.get('rpm-releases', []):
                self.release(spec, 'rpm')
            for spec in self.profile.get('appimage-releases', []):
                self.release(spec, 'appimage')
            if self.profile.get('flatpak'):
                self.run('flatpak', 'remote-add', '--user', '--if-not-exists', 'flathub', 'https://flathub.org/repo/flathub.flatpakrepo')
                self.run('flatpak', 'install', '--user', '--noninteractive', '-y', 'flathub', *self.profile['flatpak'])
        for tool in self.common['uv']:
            self.run('uv', 'tool', 'install', '--upgrade', tool)
        if getattr(self.args, 'update', False):
            self.run('tldr', '--update')
        self.node()
    def shell(self):
        self.preflight_shell()
        self.ensure_identity()
        session = f'export DOTFILES_DIR={shlex.quote(str(ROOT))}\nexport DOTFILES_PROFILE={shlex.quote(self.args.profile)}\n'
        self.write(self.config / 'session.sh', session)
        hook = 'if [ -r "$HOME/.config/dotfiles/session.sh" ]; then\n  . "$HOME/.config/dotfiles/session.sh"\n  . "$DOTFILES_DIR/shell/common/init.sh"\nfi'
        self.hook(self.home / '.zshenv', hook)
        self.hook(self.home / '.zshrc', hook + '\nif [ -n "${DOTFILES_DIR:-}" ]; then\n  . "$DOTFILES_DIR/shell/interactive/init.zsh"\nfi')
        # User startup snippets can overwrite DOTFILES_DIR/PATH. Restore the
        # installed session immediately before loading prompt integrations.
        bash_hook = 'case $- in\n  *i*)\n' + hook + '\n    if [ -n "${DOTFILES_DIR:-}" ]; then\n      . "$DOTFILES_DIR/shell/interactive/init.bash"\n    fi\n    ;;\nesac'
        # Debian's .bashrc returns early over SSH; put only environment above it.
        self.hook(self.home / '.bashrc', hook, prepend=True, label='environment')
        self.hook(self.home / '.bashrc', bash_hook)
        login = self.home / '.bash_profile'
        if not login.exists():
            self.write(login, '# Preserve distribution login setup.\nif [ -r "$HOME/.profile" ]; then\n  . "$HOME/.profile"\nfi\n')
        self.hook(login, hook + '\n' + bash_hook)
        # Preserve unrelated global settings; the ignored identity include wins.
        gitconfig = (
            '[include]\n  path = ' + json.dumps(str(ROOT / 'git/.gitconfig'), ensure_ascii=False) + '\n'
            '[include]\n  path = ' + json.dumps(str(self.identity), ensure_ascii=False) + '\n'
            '[core]\n  excludesFile = ' + json.dumps(str(ROOT / 'git/.gitignore_global'), ensure_ascii=False) + '\n  editor = vim\n'
        )
        if self.args.profile != 'debian-server':
            gitconfig += '[core]\n  editor = ' + ('code' if self.args.profile == 'macos' else 'codium') + ' --wait\n'
        gitconfig += '[alias]\n  ci = !gh run list --limit 5\n'
        if self.args.profile == 'debian-server':
            gitconfig += '  open = !gh repo view\n  k = !gh repo view\n'
        else:
            gitconfig += '  open = !gh repo view --web\n'
            gitconfig += '  k = ' + json.dumps('!open -a "GitHub Desktop"' if self.args.profile == 'macos' else '!github-desktop') + '\n'
        self.write(self.config / 'gitconfig', gitconfig)
        global_git = self.home / '.gitconfig'
        if global_git.is_symlink() and global_git.resolve() == ROOT / 'git/.gitconfig':
            self.write(global_git, '')
        self.hook(global_git, '[include]\n  path = ' + json.dumps(str(self.config / 'gitconfig'), ensure_ascii=False))
        if self.args.profile == 'macos':
            self.write(self.home / '.finicky.js', (ROOT / 'apps/finicky.template.js').read_bytes())
        self.run('git', 'submodule', 'update', '--init', '--',
                 'zsh/plugins/zsh-autosuggestions', 'zsh/plugins/zsh-syntax-highlighting', cwd=ROOT)

    def extensions(self):
        if self.args.profile == 'debian-server':
            print('Server profile: no desktop editor extensions.')
            return
        command = 'code' if self.args.profile == 'macos' else 'codium'
        if self.args.apply and not shutil.which(command, path=self.env['PATH']):
            raise ValueError(f'{command} is missing; install packages first')
        if self.args.apply:
            output = self.run('fnm', 'exec', '--log-level=quiet', '--using=default', 'node', '-p', 'process.execPath', capture=True)
            self.env['PATH'] = str(Path(output.strip()).parent) + os.pathsep + self.env['PATH']
        config = manifest(ROOT / 'profiles/common/vscode-extension.yaml')
        for extension in config['common'] + config.get(self.args.profile, []):
            try:
                self.run(command, '--install-extension', extension)
            except subprocess.CalledProcessError:
                self.failures.append(f'Extension unavailable or incompatible: {extension} ({command})')
        for spec in config.get('source', []):
            repo, commit = shlex.split(spec)
            print(f'Build unpublished extension: {repo}@{commit}')
            if self.args.apply:
                with tempfile.TemporaryDirectory(prefix='dotfiles-vsix-') as directory:
                    self.run('git', 'clone', f'https://github.com/{repo}.git', directory)
                    self.run('git', 'checkout', '--detach', commit, cwd=directory)
                    self.run('npm', 'ci', cwd=directory)
                    vsix = Path(directory) / 'extension.vsix'
                    self.run('npx', '--yes', '@vscode/vsce', 'package', '--out', vsix, cwd=directory)
                    self.run(command, '--install-extension', vsix)

    def browsers(self):
        if self.args.profile == 'debian-server':
            print('Server profile: no browser extensions or GUI browser setup.')
            return
        config = manifest(ROOT / 'profiles/common/browser-extensions.yaml')
        slugs = config['firefox'] + (config.get('fedora-firefox', []) if self.args.profile == 'fedora' else [])
        links = [(slug, 'https://addons.mozilla.org/firefox/addon/' + slug + '/') for slug in slugs]
        text = '<!doctype html><meta charset="utf-8"><title>Browser extensions</title><h1>Firefox, LibreWolf and Zen</h1><p>Open these links in each browser and confirm installation.</p><ul>'
        text += ''.join(f'<li><a href="{html.escape(url)}">{html.escape(name)}</a></li>' for name, url in links) + '</ul>'
        if self.args.profile == 'macos':
            text += '<h1>Chrome and Chromium</h1><ul>'
            text += ''.join(f'<li><a href="https://chromewebstore.google.com/detail/{identifier}">{label}</a></li>' for identifier, label in zip(config['chromium'], ('github-mermaid-jsdoc-viewer', 'pr-review-collector'))) + '</ul>'
        if self.args.profile == 'fedora':
            text += '<p>Open Switchyard after installation to configure routing and select it as your default browser.</p>'
        self.write(self.config / 'browser-extensions.html', text + '\n')
        # Generate, do not deploy system/browser policies to unknown profile paths.
        if self.args.firefox_policy:
            policy = self.config / 'firefox-policies.json'
            print(f'Generate Firefox policy at {policy} using AMO extension IDs')
            if self.args.apply:
                settings = {}
                for slug in slugs:
                    addon = json.loads(fetch(f'https://addons.mozilla.org/api/v5/addons/addon/{slug}/'))
                    settings[addon['guid']] = {'installation_mode': 'normal_installed', 'install_url': addon['current_version']['file']['url']}
                self.write(policy, json.dumps({'policies': {'ExtensionSettings': settings}}, indent=2) + '\n')

    def execute(self):
        print(f'Profile: {self.args.profile}; mode: {"APPLY" if self.args.apply else "DRY RUN"}; home: {self.home}')
        if self.args.apply and 'shell' in self.args.only:
            self.preflight_shell()
        for note in self.common.get('notes', []) + self.profile.get('notes', []):
            print('Note: ' + note)
        for step in self.args.only:
            getattr(self, step)()
        for failure in self.failures:
            print('ACTION REQUIRED: ' + failure, file=sys.stderr)
        if self.failures and self.args.apply:
            return 1
        print('Done.' if self.args.apply else 'Preview complete; nothing was installed or changed.')
        if self.args.apply and 'shell' in self.args.only:
            print('Start a new shell to load the configuration.')
        if 'browsers' in self.args.only and self.args.profile != 'debian-server':
            print(f'Browser setup page: {self.config / "browser-extensions.html"}')
        return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', choices=PROFILES, default=detect_profile())
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true', help='perform installation (default is a dry run)')
    mode.add_argument('--dry-run', action='store_true', help='print the plan without writes/network')
    mode.add_argument('--update', action='store_true', help='apply package updates for the detected profile')
    parser.add_argument('--home', type=Path, default=Path.home(), help='configuration destination; package installs still affect the host')
    parser.add_argument('--only', default=','.join(STEPS), help='comma-separated: packages,shell,extensions,browsers')
    parser.add_argument('--firefox-policy', action='store_true', help='also generate an optional Firefox extension policy')
    args = parser.parse_args(argv)
    if args.update:
        args.apply = True
        args.only = 'packages'
    if not args.profile:
        parser.error('Cannot detect a supported OS; choose --profile to preview')
    args.only = args.only.split(',')
    if any(s not in STEPS for s in args.only) or len(set(args.only)) != len(args.only):
        parser.error('--only must contain unique known steps')
    if args.apply and args.profile != detect_profile():
        parser.error('Applying a profile for a different OS is not supported; use --dry-run')
    if args.apply and os.geteuid() == 0:
        parser.error('Run as your normal user; native package steps invoke sudo as needed')
    try:
        return Installer(args).execute()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f'Installation stopped: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
