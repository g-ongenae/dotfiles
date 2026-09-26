#!/usr/bin/env python3
"""Opt-in local service setup and macOS launchd control for the t3 shell helper."""
import os
from pathlib import Path
import plistlib
import re
import shlex
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parent.parent
LABEL = 'com.dotfiles.t3code'


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def setup(home, macos):
    data = home / '.local/share/dotfiles/t3'
    service = (home / 'Library/LaunchAgents' / (LABEL + '.plist') if macos
               else home / '.config/systemd/user/t3code.service')
    existing = service.exists() or service.is_symlink()
    upstream = home / 'Library/LaunchAgents/com.t3tools.t3code.service.plist'
    if macos and not existing and upstream.exists():
        print(f'Keeping existing service: {upstream}')
        return

    executable = shutil.which('t3code-server') or shutil.which('t3')
    if executable:
        # Resolve fnm's per-shell symlink, since a service outlives the shell
        # that created it, but keep npm's own entry point: what that entry
        # point runs is an implementation file, free to move between releases
        # and to ship without an executable bit, as t3 0.0.42 did.
        executable = Path(executable)
        executable = executable.parent.resolve() / executable.name
        help_text = run(str(executable), '--help', capture_output=True, text=True).stdout
        # Recent CLI releases use `serve`; older AppImage wrappers take flags directly.
        command = [str(executable)] + (['serve'] if re.search(r'^\s*(?:t3\s+)?serve\b', help_text, re.M) else [])
    else:
        appimage = shutil.which('t3-code')
        if macos or not appimage:
            raise ValueError('Install this profile\'s T3 package before running t3 setup.')
        data.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix='extract-', dir=data) as temporary:
            run(appimage, '--appimage-extract', cwd=temporary, stdout=subprocess.DEVNULL)
            extracted = Path(temporary) / 'squashfs-root'
            runtime = data / 'appimage'
            if runtime.exists():
                raise ValueError(f'{runtime} already exists; move it aside before retrying setup.')
            extracted.rename(runtime)
        executable = runtime / 't3code'
        entry = runtime / 'resources/app.asar/apps/server/dist/bin.mjs'
        command = ['env', 'ELECTRON_RUN_AS_NODE=1', str(executable), str(entry)]

    command += ['--host', '127.0.0.1', '--port', '3773', '--no-browser']
    data.mkdir(parents=True, exist_ok=True)
    launcher = data / 'server.sh'
    launcher.write_text('#!/bin/sh\n'
                        f'export DOTFILES_DIR={shlex.quote(str(ROOT))}\n'
                        f'export DOTFILES_PROFILE={shlex.quote(os.environ.get("DOTFILES_PROFILE", ""))}\n'
                        '. "$DOTFILES_DIR/shell/common/init.sh"\n'
                        f'exec {shlex.join(command)}\n')
    launcher.chmod(0o755)
    if existing:
        # The service file is left as it is, but the launcher beside it is
        # generated, and rewriting it is how a machine recovers when an update
        # moves the CLI out from under a service that still points at it.
        print(f'Keeping existing service: {service}')
        print(f'Refreshed {launcher}. Run t3 restart to run it.')
        return
    service.parent.mkdir(parents=True, exist_ok=True)
    if macos:
        service.write_bytes(plistlib.dumps({
            'Label': LABEL, 'ProgramArguments': ['/bin/sh', str(launcher)],
            'WorkingDirectory': str(home), 'RunAtLoad': True,
            'KeepAlive': {'SuccessfulExit': False},
            'EnvironmentVariables': {'PATH': os.environ['PATH'], 'HOME': str(home)},
            'StandardOutPath': str(data / 'server.log'),
            'StandardErrorPath': str(data / 'server.log'),
        }))
    else:
        # systemd expands percent specifiers even in quoted command arguments.
        quoted_launcher = '"' + str(launcher).replace('\\', '\\\\').replace('"', '\\"').replace('%', '%%') + '"'
        service.write_text('[Unit]\nDescription=T3 Code server\nAfter=network.target\n\n'
                           '[Service]\nType=simple\nWorkingDirectory=%h\n'
                           f'ExecStart=/bin/sh {quoted_launcher}\n'
                           'Restart=on-failure\nRestartSec=5\n\n'
                           '[Install]\nWantedBy=default.target\n')
        run('systemctl', '--user', 'daemon-reload')
    print(f'Created {service}. Run t3 start, then t3 connect to share it.')


def mac_action(home, action):
    service = home / 'Library/LaunchAgents' / (LABEL + '.plist')
    upstream = home / 'Library/LaunchAgents/com.t3tools.t3code.service.plist'
    if not service.exists() and upstream.exists():
        service = upstream
    # Without a service, launchctl only reports that the label is unknown.
    if not service.exists():
        raise ValueError('No local service on this machine: run t3 setup to create one, '
                         'or set T3_HOST=user@tailnet-host to control a Linux server.')
    config = plistlib.loads(service.read_bytes())
    target = f'gui/{os.getuid()}/{config["Label"]}'
    if action in ('inspect', 'status'):
        run('launchctl', 'print', target)
    elif action == 'logs':
        paths = list(dict.fromkeys(config[key] for key in ('StandardOutPath', 'StandardErrorPath') if key in config))
        if not paths:
            raise ValueError('No service log path found; run t3 setup first.')
        run('tail', '-n', '100', '-F', *paths)
    elif action == 'stop':
        run('launchctl', 'bootout', target)
    elif action in ('start', 'restart'):
        loaded = subprocess.run(['launchctl', 'print', target], stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL).returncode == 0
        if loaded:
            run('launchctl', 'kickstart', *(['-k'] if action == 'restart' else []), target)
        else:
            run('launchctl', 'bootstrap', f'gui/{os.getuid()}', str(service))
    else:
        raise ValueError(f'Unknown action: {action}')


def main():
    try:
        home = Path.home()
        if sys.argv[1] == 'setup':
            setup(home, os.environ.get('DOTFILES_PROFILE') == 'macos')
        else:
            mac_action(home, sys.argv[1])
    except (ValueError, OSError) as error:
        print(f't3: {error}', file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as error:
        return error.returncode
    return 0


if __name__ == '__main__':
    sys.exit(main())
