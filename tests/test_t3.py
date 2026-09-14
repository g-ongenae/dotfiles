"""Exercise the helper with fake commands; never touch services or networking."""
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent


class T3Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.bin = self.home / 'bin'
        self.bin.mkdir()
        self.log = self.home / 'calls.jsonl'
        self.env = dict(HOME=str(self.home), PATH=str(self.bin),
                        DOTFILES_DIR=str(ROOT), CALL_LOG=str(self.log))
        (self.bin / 'bash').symlink_to(shutil.which('bash'))
        (self.bin / 'python3').symlink_to(sys.executable)
        for name in ('systemctl', 'journalctl', 'ssh', 'tailscale', 'sudo', 'launchctl', 't3', 'tail'):
            tool = self.bin / name
            tool.write_text(
                f'#!{sys.executable}\n'
                'import json, os, sys\n'
                'from pathlib import Path\n'
                'with open(os.environ["CALL_LOG"], "a") as output:\n'
                '    output.write(json.dumps([Path(sys.argv[0]).name] + sys.argv[1:]) + "\\n")\n'
                'if Path(sys.argv[0]).name == "t3": print("  serve  Run the server")\n'
                'sys.exit(int(os.environ.get("COMMAND_EXIT", "0")))\n')
            tool.chmod(0o755)

    def run_t3(self, *args, **env):
        return subprocess.run([str(self.bin / 'bash'), str(ROOT / 'scripts/t3.sh'), *args],
                              env=dict(self.env, **env), text=True, capture_output=True)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_default_inspects_and_preserves_inactive_exit_status(self):
        result = self.run_t3(COMMAND_EXIT='3')
        self.assertEqual(result.returncode, 3)
        self.assertEqual(self.calls(), [
            ['systemctl', '--user', 'status', 't3code.service', '--no-pager', '--full']])

    def test_lifecycle_and_logs(self):
        for action in ('start', 'restart', 'stop', 'logs'):
            self.assertEqual(self.run_t3(action).returncode, 0)
        self.assertEqual(self.calls(), [
            ['systemctl', '--user', action, 't3code.service']
            for action in ('start', 'restart', 'stop')
        ] + [['journalctl', '--user', '-u', 't3code.service', '-n', '100', '-f']])

    def test_remote_control_uses_ssh_and_propagates_errors(self):
        result = self.run_t3('restart', T3_HOST='g@fujitsu', COMMAND_EXIT='255')
        self.assertEqual(result.returncode, 255)
        self.assertEqual(self.calls(), [
            ['ssh', '--', 'g@fujitsu', 'systemctl --user restart t3code.service']])

    def test_invalid_arguments_and_help_never_execute_commands(self):
        for args in [('bad',), ('start', 'extra'), ('start; touch /tmp/no',)]:
            self.assertEqual(self.run_t3(*args).returncode, 2)
        self.assertEqual(self.run_t3('--help').returncode, 0)
        self.assertEqual(self.calls(), [])

    def test_connect_and_disconnect_only_change_the_t3_serve_listener(self):
        self.assertEqual(self.run_t3('connect').returncode, 0)
        self.assertEqual(self.run_t3('disconnect').returncode, 0)
        self.assertEqual(self.calls(), [
            ['sudo', 'tailscale', 'serve', '--bg', '--https=3773', 'http://127.0.0.1:3773'],
            ['sudo', 'tailscale', 'serve', '--https=3773', 'off'],
        ])

    def test_remote_disconnect_has_a_terminal_for_sudo(self):
        result = self.run_t3('disconnect', T3_HOST='g@fujitsu', COMMAND_EXIT='1')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.calls(), [
            ['ssh', '-t', '--', 'g@fujitsu', 'sudo tailscale serve --https=3773 off']])

    def test_missing_tailscale_does_not_run_sudo(self):
        (self.bin / 'tailscale').unlink()
        result = self.run_t3('connect')
        self.assertEqual(result.returncode, 127)
        self.assertIn('install Tailscale', result.stderr)
        self.assertEqual(self.calls(), [])

    def test_macos_uses_app_cli_without_sudo_and_can_target_linux_remotely(self):
        self.assertEqual(self.run_t3('connect', DOTFILES_PROFILE='macos').returncode, 0)
        self.assertEqual(self.run_t3('disconnect', DOTFILES_PROFILE='macos').returncode, 0)
        self.assertEqual(self.run_t3('start', DOTFILES_PROFILE='macos', T3_HOST='g@fujitsu').returncode, 0)
        self.assertEqual(self.calls(), [
            ['tailscale', 'serve', '--bg', '--https=3773', 'http://127.0.0.1:3773'],
            ['tailscale', 'serve', '--https=3773', 'off'],
            ['ssh', '--', 'g@fujitsu', 'systemctl --user start t3code.service'],
        ])

    def test_local_setup_is_opt_in_preserves_services_and_does_not_start_them(self):
        result = self.run_t3('setup', DOTFILES_PROFILE='fedora')
        self.assertEqual(result.returncode, 0, result.stderr)
        service = self.home / '.config/systemd/user/t3code.service'
        self.assertIn('ExecStart=/bin/sh', service.read_text())
        launcher = self.home / '.local/share/dotfiles/t3/server.sh'
        self.assertIn('serve --host 127.0.0.1 --port 3773 --no-browser', launcher.read_text())
        self.assertIn('shell/common/init.sh', launcher.read_text())
        self.assertEqual(self.calls(), [['t3', '--help'], ['systemctl', '--user', 'daemon-reload']])
        service.write_text('Existing Fujitsu service\n')
        self.assertEqual(self.run_t3('setup', DOTFILES_PROFILE='debian-server').returncode, 0)
        self.assertEqual(service.read_text(), 'Existing Fujitsu service\n')
        self.assertEqual(len(self.calls()), 2)

    def test_macos_setup_and_local_lifecycle(self):
        result = self.run_t3('setup', DOTFILES_PROFILE='macos')
        self.assertEqual(result.returncode, 0, result.stderr)
        service = self.home / 'Library/LaunchAgents/com.dotfiles.t3code.plist'
        config = plistlib.loads(service.read_bytes())
        self.assertEqual(config['ProgramArguments'], [
            '/bin/sh', str(self.home / '.local/share/dotfiles/t3/server.sh')])
        self.assertEqual(self.calls(), [['t3', '--help']])
        for action in ('start', 'restart', 'inspect', 'stop', 'logs'):
            result = self.run_t3(action, DOTFILES_PROFILE='macos')
            self.assertEqual(result.returncode, 0, result.stderr)
        target = f'gui/{os.getuid()}/com.dotfiles.t3code'
        self.assertEqual(self.calls()[1:], [
            ['launchctl', 'print', target], ['launchctl', 'kickstart', target],
            ['launchctl', 'print', target], ['launchctl', 'kickstart', '-k', target],
            ['launchctl', 'print', target], ['launchctl', 'bootout', target],
            ['tail', '-n', '100', '-F', str(self.home / '.local/share/dotfiles/t3/server.log')],
        ])

    def test_remote_setup_does_not_create_local_files(self):
        self.assertEqual(self.run_t3('setup', T3_HOST='g@fujitsu').returncode, 2)
        self.assertFalse((self.home / '.local').exists())
        self.assertEqual(self.calls(), [])

    def test_macos_stopped_service_bootstraps_on_start(self):
        self.assertEqual(self.run_t3('setup', DOTFILES_PROFILE='macos').returncode, 0)
        launchctl = self.bin / 'launchctl'
        launchctl.write_text(launchctl.read_text().replace(
            'sys.exit(int(os.environ.get("COMMAND_EXIT", "0")))',
            'sys.exit(113 if sys.argv[1] == "print" else 0)'))
        result = self.run_t3('start', DOTFILES_PROFILE='macos')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls()[-1], [
            'launchctl', 'bootstrap', f'gui/{os.getuid()}',
            str(self.home / 'Library/LaunchAgents/com.dotfiles.t3code.plist')])

    def test_macos_existing_upstream_agent_is_preserved_and_controlled(self):
        service = self.home / 'Library/LaunchAgents/com.t3tools.t3code.service.plist'
        service.parent.mkdir(parents=True)
        content = plistlib.dumps({'Label': 'com.t3tools.t3code.service',
                                 'StandardOutPath': '/tmp/t3-out', 'StandardErrorPath': '/tmp/t3-err'})
        service.write_bytes(content)
        self.assertEqual(self.run_t3('setup', DOTFILES_PROFILE='macos').returncode, 0)
        self.assertEqual(service.read_bytes(), content)
        self.assertEqual(self.calls(), [])
        self.assertEqual(self.run_t3('inspect', DOTFILES_PROFILE='macos').returncode, 0)
        self.assertEqual(self.run_t3('logs', DOTFILES_PROFILE='macos').returncode, 0)
        self.assertEqual(self.calls(), [
            ['launchctl', 'print', f'gui/{os.getuid()}/com.t3tools.t3code.service'],
            ['tail', '-n', '100', '-F', '/tmp/t3-out', '/tmp/t3-err']])

    def test_fresh_debian_extracts_appimage_without_launching_server(self):
        (self.bin / 't3').unlink()
        appimage = self.bin / 't3-code'
        appimage.write_text(f'#!{sys.executable}\n'
                            'import sys\nfrom pathlib import Path\n'
                            'assert sys.argv[1:] == ["--appimage-extract"]\n'
                            'Path("squashfs-root").mkdir()\n'
                            'Path("squashfs-root/t3code").touch()\n')
        appimage.chmod(0o755)
        result = self.run_t3('setup', DOTFILES_PROFILE='debian-server')
        self.assertEqual(result.returncode, 0, result.stderr)
        data = self.home / '.local/share/dotfiles/t3'
        self.assertTrue((data / 'appimage/t3code').exists())
        launcher = (data / 'server.sh').read_text()
        self.assertIn('env ELECTRON_RUN_AS_NODE=1', launcher)
        self.assertIn('resources/app.asar/apps/server/dist/bin.mjs', launcher)
        self.assertIn('--host 127.0.0.1', launcher)
        self.assertEqual(self.calls(), [['systemctl', '--user', 'daemon-reload']])

    def test_missing_local_service_manager_explains_remote_option(self):
        (self.bin / 'systemctl').unlink()
        result = self.run_t3('start')
        self.assertEqual(result.returncode, 127)
        self.assertIn('T3_HOST', result.stderr)

    def test_common_startup_is_silent_and_loads_helper_on_every_profile(self):
        for profile in ('macos', 'fedora', 'debian-server'):
            result = subprocess.run(
                [str(self.bin / 'bash'), '--noprofile', '--norc', '-c',
                 '. "$DOTFILES_DIR/shell/common/init.sh"; t3 --help'],
                env=dict(self.env, DOTFILES_PROFILE=profile), text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertTrue(result.stdout.startswith('Usage: t3'))
            self.assertEqual(result.stderr, '')
        self.assertEqual(self.calls(), [])
