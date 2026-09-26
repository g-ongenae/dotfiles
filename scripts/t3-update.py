#!/usr/bin/env python3
"""Update the T3 CLI and the coding agents installed on this machine.

`t3 update` runs this file, either directly or piped to `python3 -` over SSH,
so it stands on its own: nothing here imports from this checkout, which a
server controlled with T3_HOST does not need. What it updates is whatever is
actually installed, through the same source the installer used:

  * T3 itself, as the npm package or as the AppImage the service extracts;
  * Claude Code, Codex, Gemini and the Antigravity CLI, when present.

Whatever is absent is skipped, not installed: adding a tool to a machine stays
the installer's job.
"""
import fnmatch
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import urllib.request


HOME = Path.home()
BIN = HOME / '.local/bin'
# The AppImage the Debian service runs, extracted beside the executable itself.
RUNTIME = HOME / '.local/share/dotfiles/t3/appimage'
T3_REPO = 'pingdotgg/t3code'
T3_ASSET = 'T3-Code-*-x86_64.AppImage'
LABELS = ('com.dotfiles.t3code', 'com.t3tools.t3code.service')


def environment():
    """The PATH this machine uses interactively, rebuilt for a bare SSH session.

    A command sent over SSH reads no profile, so neither ~/.local/bin nor the
    Node that carries npm and the npm-installed agents is on its PATH. The
    installer records that Node in ~/.config/dotfiles/node-path.sh.
    """
    directories = [str(BIN)]
    record = HOME / '.config/dotfiles/node-path.sh'
    if record.exists():
        # `dotfiles_prepend_path <directory>`, written by scripts/install.py.
        words = shlex.split(record.read_text())
        if len(words) == 2:
            directories.append(words[1])
    environ = dict(os.environ)
    environ['PATH'] = os.pathsep.join(directories + [environ.get('PATH', '')])
    return environ


ENV = environment()


def tool(name):
    return shutil.which(name, path=ENV['PATH'])


def run(*args, **kwargs):
    print('  ' + shlex.join(str(argument) for argument in args))
    return subprocess.run([str(argument) for argument in args], check=True, env=ENV, **kwargs)


def output(*args):
    return subprocess.run([str(argument) for argument in args], check=True, env=ENV,
                          capture_output=True, text=True).stdout


def fetch(url):
    if not url.startswith('https://'):
        raise ValueError('Downloads must use HTTPS')
    request = urllib.request.Request(url, headers={'User-Agent': 'dotfiles-t3-update'})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def latest_release(repository):
    return json.loads(fetch(f'https://api.github.com/repos/{repository}/releases/latest'))


def service_target():
    """The launchd label or systemd unit this machine runs T3 under, if loaded."""
    if sys.platform == 'darwin':
        for label in LABELS:
            target = f'gui/{os.getuid()}/{label}'
            if subprocess.run(['launchctl', 'print', target],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
                return target
        return None
    active = subprocess.run(['systemctl', '--user', 'is-active', '--quiet', 't3code.service'])
    return 't3code.service' if active.returncode == 0 else None


def restart_service(target):
    """Hand the running server over to the code just installed."""
    print(f'Restart {target}, which is running the previous version')
    if sys.platform == 'darwin':
        run('launchctl', 'kickstart', '-k', target)
    else:
        run('systemctl', '--user', 'restart', target)


def update_appimage():
    """Replace the AppImage and the copy the service runs from.

    The installer writes the AppImage to ~/.local/bin/t3-code and `t3 setup`
    extracts it; both have to move together or the service keeps its old code.
    """
    release = latest_release(T3_REPO)
    assets = [a for a in release['assets'] if fnmatch.fnmatchcase(a['name'], T3_ASSET)]
    if len(assets) != 1:
        raise ValueError(f'{T3_REPO}: expected one asset matching {T3_ASSET}, found {len(assets)}')
    asset = assets[0]
    content = fetch(asset['browser_download_url'])
    digest = hashlib.sha256(content).hexdigest()
    published = asset.get('digest') or ''
    expected = published.removeprefix('sha256:') if published.startswith('sha256:') else ''
    if expected and expected != digest:
        raise ValueError(f'Checksum mismatch for {T3_REPO}/{asset["name"]}')

    executable = BIN / 't3-code'
    if executable.exists() and hashlib.sha256(executable.read_bytes()).hexdigest() == digest:
        print(f'T3 {release["tag_name"]} is already the installed AppImage')
        return False

    print(f'Install T3 {release["tag_name"]} from {asset["name"]}')
    BIN.mkdir(parents=True, exist_ok=True)
    # Write beside the target and move it into place: the old AppImage may be
    # executing, and replacing its contents in place would break that process.
    with tempfile.NamedTemporaryFile(dir=BIN, prefix='.t3-code-', delete=False) as handle:
        handle.write(content)
        staged = Path(handle.name)
    staged.chmod(0o755)
    staged.replace(executable)

    if RUNTIME.exists():
        with tempfile.TemporaryDirectory(prefix='extract-', dir=RUNTIME.parent) as directory:
            run(executable, '--appimage-extract', cwd=directory, stdout=subprocess.DEVNULL)
            previous = RUNTIME.with_name('appimage.previous')
            shutil.rmtree(previous, ignore_errors=True)
            RUNTIME.rename(previous)
            (Path(directory) / 'squashfs-root').rename(RUNTIME)
            shutil.rmtree(previous, ignore_errors=True)
    return True


def npm_installed(package):
    """Whether npm is the one holding this package, rather than some other source."""
    if not tool('npm'):
        return False
    return subprocess.run(['npm', 'ls', '--global', '--depth=0', package], env=ENV,
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0


def update_t3():
    """Update T3 through whichever of its two install paths this machine uses."""
    print('== T3 Code')
    if (BIN / 't3-code').exists() or RUNTIME.exists():
        return update_appimage()
    if npm_installed('t3'):
        run('npm', 'install', '--global', 't3')
        return True
    if tool('t3') or tool('t3code-server'):
        print('The T3 CLI here came from neither npm nor the AppImage; leaving it alone.')
        return False
    print('No T3 CLI on this machine; the installer puts one there.')
    return False


def update_claude():
    """Install the version GitHub publishes, which is what works on these machines.

    `claude update` is the documented route and fails here, while
    `claude install <version>` takes an explicit version and succeeds.
    """
    version = latest_release('anthropics/claude-code')['tag_name'].lstrip('v')
    current = output('claude', '--version').split()[0]
    if current == version:
        print(f'claude {version} is already installed')
        return
    print(f'claude {current} -> {version}')
    run('claude', 'install', version)


# Each agent updates through the source that installed it: the native installer
# for Claude Code, npm for the two npm packages, its own command for Antigravity.
AGENTS = (
    ('claude', update_claude),
    ('codex', lambda: run('npm', 'install', '--global', '@openai/codex')),
    ('gemini', lambda: run('npm', 'install', '--global', '@google/gemini-cli')),
    ('agy', lambda: run('agy', 'update')),
)


def update_agents():
    print('== Agents')
    absent = [name for name, _ in AGENTS if not tool(name)]
    for name, update in AGENTS:
        if tool(name):
            update()
    if absent:
        print('Not installed here, so not updated: ' + ', '.join(absent))


def main():
    try:
        if update_t3():
            # Asked for only once something has replaced what it is running.
            target = service_target()
            if target:
                restart_service(target)
        update_agents()
    except (ValueError, OSError) as error:
        print(f't3: {error}', file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as error:
        return error.returncode
    return 0


if __name__ == '__main__':
    sys.exit(main())
