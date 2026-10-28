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
        # Real sleep: the macOS connect deadline times its own commands with it.
        (self.bin / 'sleep').symlink_to(shutil.which('sleep'))
        for name in ('systemctl', 'systemd-run', 'journalctl', 'ssh', 'tailscale', 'sudo', 'launchctl', 't3', 'tail', 'open'):
            tool = self.bin / name
            tool.write_text(
                f'#!{sys.executable}\n'
                'import json, os, sys\n'
                'from pathlib import Path\n'
                'with open(os.environ["CALL_LOG"], "a") as output:\n'
                '    output.write(json.dumps([Path(sys.argv[0]).name] + sys.argv[1:]) + "\\n")\n'
                'if Path(sys.argv[0]).name == "sudo" and "SERVE_EXIT" in os.environ: sys.exit(int(os.environ["SERVE_EXIT"]))\n'
                'if Path(sys.argv[0]).name == "systemctl":\n'
                '    if "--property=MainPID" in sys.argv: print(os.environ.get("MAIN_PID", "1234"))\n'
                '    if "--property=LoadState" in sys.argv: print(os.environ.get("NOSLEEP_STATE", "not-found"))\n'
                '    if "is-active" in sys.argv and sys.argv[-1] == "t3code-nosleep.service": sys.exit(0 if os.environ.get("NOSLEEP_STATE") == "loaded" else 3)\n'
                '    if "is-active" in sys.argv: sys.exit(0 if os.environ.get("T3_STATE", "active") == "active" else 3)\n'
                'if Path(sys.argv[0]).name == "t3" and sys.argv[-3:] == ["connect", "status", "--json"]:\n'
                '    calls = [json.loads(line) for line in Path(os.environ["CALL_LOG"]).read_text().splitlines()]\n'
                '    linked = os.environ.get("T3_LINKED") == "1" or any(call[0] == "t3" and "link" in call for call in calls)\n'
                '    relay = os.environ.get("T3_RELAY", "available" if linked else "missing")\n'
                '    print(json.dumps({"desired": linked, "linked": linked, "revoked": False, "relayClient": {"status": relay, "version": "2026.10.4"}}, indent=2))\n'
                'elif Path(sys.argv[0]).name == "t3":\n'
                '    print("Pairing URL: https://server:3773/#token=code\\nToken: code\\nQR: ▄█" if sys.argv[1] == "pair" else "  serve  Run the server")\n'
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
        for args in [('bad',), ('start', 'extra'), ('start; touch /tmp/no',), ('tailscale',),
                     ('tailscale', 'pair'), ('tailscale-connect',), ('tailscale', 'disconnect', 'nosleep'),
                     ('connect', 'bad')]:
            self.assertEqual(self.run_t3(*args).returncode, 2)
        self.assertEqual(self.run_t3('--help').returncode, 0)
        self.assertEqual(self.calls(), [])

    def test_connect_and_disconnect_only_change_the_t3_serve_listener(self):
        self.assertEqual(self.run_t3('tailscale', 'connect').returncode, 0)
        self.assertEqual(self.run_t3('tailscale', 'disconnect').returncode, 0)
        self.assertEqual(self.calls(), [
            ['sudo', 'tailscale', 'serve', '--bg', '--https=3773', 'http://127.0.0.1:3773'],
            ['t3', 'pair', '--tailscale', '--tailscale-serve-port', '3773'],
            ['sudo', 'tailscale', 'serve', '--https=3773', 'off'],
            ['systemctl', '--user', 'show', 't3code-nosleep.service', '--property=LoadState', '--value'],
        ])

    def test_pairing_output_on_all_profiles(self):
        for profile in ('fedora', 'debian-server', 'macos'):
            result = self.run_t3('tailscale', 'connect', DOTFILES_PROFILE=profile)
            self.assertEqual(result.returncode, 0, result.stderr)
            for text in ('Pairing URL:', 'Token: code', 'QR: ▄█'):
                self.assertIn(text, result.stdout)

    def test_failed_serve_does_not_mint_credentials(self):
        result = self.run_t3('tailscale', 'connect', COMMAND_EXIT='1')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(self.calls()), 1)

    def test_remote_connect_runs_pairing_on_server(self):
        result = self.run_t3('tailscale', 'connect', T3_HOST='g@fujitsu')
        self.assertEqual(result.returncode, 0, result.stderr)
        call = self.calls()[0]
        self.assertEqual(call[:4], ['ssh', '-t', '--', 'g@fujitsu'])
        # Execute the payload under a clean shell, as on the SSH server.
        result = subprocess.run([str(self.bin / 'bash'), '-c', call[4]],
                                env=self.env, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Pairing URL:', result.stdout)
        self.assertIn('QR: ▄█', result.stdout)
        self.assertEqual(self.calls()[-1],
                         ['t3', 'pair', '--tailscale', '--tailscale-serve-port', '3773'])

    def test_pairing_supports_wrapper_and_extracted_appimage(self):
        (self.bin / 't3').rename(self.bin / 't3code-server')
        self.assertEqual(self.run_t3('tailscale', 'connect').returncode, 0)
        self.assertEqual(self.calls()[-1][0], 't3code-server')
        runtime = self.home / '.local/share/dotfiles/t3/appimage'
        runtime.mkdir(parents=True)
        (self.bin / 't3code-server').rename(runtime / 't3code')
        self.assertEqual(self.run_t3('tailscale', 'connect').returncode, 0)
        self.assertEqual(self.calls()[-1], [
            't3code', str(runtime / 'resources/app.asar/apps/server/dist/bin.mjs'),
            'pair', '--tailscale', '--tailscale-serve-port', '3773'])

    def test_missing_discovery_state_explains_recovery_without_restarting(self):
        tool = self.bin / 't3'
        tool.write_text(tool.read_text().replace(
            'sys.exit(int(os.environ.get("COMMAND_EXIT", "0")))',
            'print("NoRunningServerError: No running T3 Code server found."); sys.exit(1)'))
        result = self.run_t3('tailscale', 'connect')
        self.assertEqual(result.returncode, 1)
        self.assertIn('t3 restart', result.stderr)
        self.assertIn('T3CODE_HOME', result.stderr)
        self.assertNotIn('NoRunningServerError', result.stderr)
        self.assertFalse(any(call[0] == 'systemctl' for call in self.calls()))

    def test_pairing_failure_is_propagated(self):
        tool = self.bin / 't3'
        tool.write_text(tool.read_text().replace(
            'sys.exit(int(os.environ.get("COMMAND_EXIT", "0")))', 'sys.exit(9)'))
        self.assertEqual(self.run_t3('tailscale', 'connect').returncode, 9)

    def test_remote_disconnect_has_a_terminal_for_sudo(self):
        result = self.run_t3('tailscale', 'disconnect', T3_HOST='g@fujitsu', COMMAND_EXIT='1')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(self.calls()[0][:4], ['ssh', '-t', '--', 'g@fujitsu'])
        self.assertTrue(self.calls()[0][4].endswith('\ndisconnect_t3_tailscale'))

    def test_nosleep_starts_inhibitor_for_server_pid(self):
        result = self.run_t3('tailscale', 'connect', 'nosleep')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn([
            'systemd-run', '--user', '--unit=t3code-nosleep', '--collect',
            '--property=BindsTo=t3code.service', '--property=After=t3code.service',
            'systemd-inhibit', '--what=sleep', '--why=Waiting for process',
            'tail', '--pid=1234', '-f', '/dev/null'], self.calls())

    def test_nosleep_repeated_connect_reuses_inhibitor(self):
        result = self.run_t3('tailscale', 'connect', '--nosleep', NOSLEEP_STATE='loaded')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any(call[0] == 'systemd-run' for call in self.calls()))

    def test_nosleep_requires_running_server(self):
        result = self.run_t3('tailscale', 'connect', 'nosleep', MAIN_PID='0')
        self.assertEqual(result.returncode, 1)
        self.assertIn('t3 start', result.stderr)
        self.assertFalse(any(call[0] in ('systemd-run', 't3') for call in self.calls()))

    def test_disconnect_releases_inhibitor_even_if_serve_fails(self):
        for status in ('0', '1'):
            result = self.run_t3('tailscale', 'disconnect', NOSLEEP_STATE='loaded', SERVE_EXIT=status)
            self.assertEqual(result.returncode, int(status))
            self.assertEqual(self.calls()[-1],
                             ['systemctl', '--user', 'stop', 't3code-nosleep.service'])

    def test_remote_nosleep_and_cleanup_run_on_server(self):
        for action, args in [('connect', ('--nosleep',)), ('disconnect', ())]:
            result = self.run_t3('tailscale', action, *args, T3_HOST='g@fujitsu', DOTFILES_PROFILE='macos')
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = self.calls()[-1][4]
            result = subprocess.run([str(self.bin / 'bash'), '-c', payload],
                                    env=dict(self.env, NOSLEEP_STATE='loaded' if action == 'disconnect' else 'not-found'),
                                    text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(any(call[0] == 'systemd-run' for call in self.calls()))
        self.assertEqual(self.calls()[-1], ['systemctl', '--user', 'stop', 't3code-nosleep.service'])

    def test_local_macos_nosleep_explains_linux_requirement(self):
        result = self.run_t3('tailscale', 'connect', 'nosleep', DOTFILES_PROFILE='macos')
        self.assertEqual(result.returncode, 2)
        self.assertIn('Linux', result.stderr)
        self.assertEqual(self.calls(), [])

    def test_missing_tailscale_does_not_run_sudo(self):
        (self.bin / 'tailscale').unlink()
        result = self.run_t3('tailscale', 'connect')
        self.assertEqual(result.returncode, 127)
        self.assertIn('install Tailscale', result.stderr)
        self.assertEqual(self.calls(), [])

    def test_macos_uses_app_cli_without_sudo_and_can_target_linux_remotely(self):
        self.assertEqual(self.run_t3('tailscale', 'connect', DOTFILES_PROFILE='macos').returncode, 0)
        self.assertEqual(self.run_t3('tailscale', 'disconnect', DOTFILES_PROFILE='macos').returncode, 0)
        self.assertEqual(self.run_t3('start', DOTFILES_PROFILE='macos', T3_HOST='g@fujitsu').returncode, 0)
        self.assertEqual(self.calls(), [
            ['tailscale', 'serve', '--bg', '--https=3773', 'http://127.0.0.1:3773'],
            ['t3', 'pair', '--tailscale', '--tailscale-serve-port', '3773'],
            ['tailscale', 'serve', '--https=3773', 'off'],
            ['ssh', '--', 'g@fujitsu', 'systemctl --user start t3code.service'],
        ])

    def test_macos_unresponsive_tailscale_gives_up_instead_of_hanging(self):
        tool = self.bin / 'tailscale'
        tool.write_text(tool.read_text().replace(
            'sys.exit(int(os.environ.get("COMMAND_EXIT", "0")))', 'import time\ntime.sleep(60)'))
        result = self.run_t3('tailscale', 'connect', DOTFILES_PROFILE='macos', T3_TAILSCALE_DEADLINE='1')
        self.assertEqual(result.returncode, 124)
        self.assertIn('Tailscale app', result.stderr)
        # Sharing never came up, so no pairing credentials were minted.
        self.assertEqual(self.calls(), [
            ['tailscale', 'serve', '--bg', '--https=3773', 'http://127.0.0.1:3773']])

    def test_macos_missing_service_names_setup_and_the_remote_option(self):
        for action in ('inspect', 'start', 'stop', 'logs'):
            result = self.run_t3(action, DOTFILES_PROFILE='macos')
            self.assertEqual(result.returncode, 1)
            self.assertIn('t3 setup', result.stderr)
            self.assertIn('T3_HOST', result.stderr)
        self.assertEqual(self.calls(), [])

    T3_LINK_CHECK = ['t3', '--log-level', 'none', 'connect', 'status', '--json']

    def test_connect_links_t3_connect_and_restarts_to_apply_it(self):
        result = self.run_t3('connect')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('restarting T3', result.stdout)
        # No display on this Linux host, so authorization uses the device flow.
        self.assertEqual(self.calls(), [
            self.T3_LINK_CHECK,
            ['t3', 'connect', 'link', '--headless'],
            ['systemctl', '--user', 'restart', 't3code.service'],
            self.T3_LINK_CHECK,
            ['t3', 'connect', 'status'],
        ])
        self.assertFalse(any(call[0] in ('sudo', 'tailscale') for call in self.calls()))

    def test_connect_uses_a_browser_at_a_desktop_session(self):
        self.assertEqual(self.run_t3('connect', DISPLAY=':0').returncode, 0)
        self.assertIn(['t3', 'connect', 'link'], self.calls())

    def test_connect_already_linked_neither_relinks_nor_restarts(self):
        result = self.run_t3('connect', 'nosleep', T3_LINKED='1')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(any('link' in call or 'restart' in call for call in self.calls()))
        self.assertTrue(any(call[0] == 'systemd-run' for call in self.calls()))
        self.assertEqual(self.calls()[-1], ['t3', 'connect', 'status'])

    def test_connect_links_again_when_the_relay_client_is_missing(self):
        # Linked, but without the client its tunnel runs on: only link offers
        # to install it, and the server needs a restart to start the tunnel.
        result = self.run_t3('connect', T3_LINKED='1', T3_RELAY='missing', T3_CONNECT_DEADLINE='0')
        self.assertIn(['t3', 'connect', 'link', '--headless'], self.calls())
        self.assertIn(['systemctl', '--user', 'restart', 't3code.service'], self.calls())
        # The fake never installs it, so the wait reports the failure.
        self.assertEqual(result.returncode, 1)
        self.assertIn('did not link', result.stderr)

    def test_connect_nosleep_inhibits_after_the_restart(self):
        result = self.run_t3('connect', '--nosleep')
        self.assertEqual(result.returncode, 0, result.stderr)
        names = [call[0] if call[0] != 'systemctl' else call[2] for call in self.calls()]
        self.assertLess(names.index('restart'), names.index('systemd-run'))

    def test_connect_failed_link_does_not_restart(self):
        result = self.run_t3('connect', COMMAND_EXIT='1')
        self.assertEqual(result.returncode, 1)
        self.assertFalse(any('restart' in call for call in self.calls()))

    def test_connect_reports_a_link_the_server_never_provisions(self):
        tool = self.bin / 't3'
        tool.write_text(tool.read_text().replace('"link" in call', '"never" in call'))
        result = self.run_t3('connect', T3_CONNECT_DEADLINE='0')
        self.assertEqual(result.returncode, 1)
        self.assertIn('did not link', result.stderr)
        self.assertEqual(self.calls()[-1], ['t3', 'connect', 'status'])

    def test_disconnect_unlinks_and_restarts_only_a_running_server(self):
        result = self.run_t3('disconnect', NOSLEEP_STATE='loaded')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [
            ['t3', 'connect', 'unlink'],
            ['systemctl', '--user', 'is-active', '--quiet', 't3code.service'],
            ['systemctl', '--user', 'restart', 't3code.service'],
            ['systemctl', '--user', 'show', 't3code-nosleep.service', '--property=LoadState', '--value'],
            ['systemctl', '--user', 'stop', 't3code-nosleep.service'],
        ])
        self.log.unlink()
        self.assertEqual(self.run_t3('disconnect', T3_STATE='inactive').returncode, 0)
        self.assertNotIn(['systemctl', '--user', 'restart', 't3code.service'], self.calls())

    def test_remote_t3_connect_runs_on_the_server_with_the_device_flow(self):
        for action, args in [('connect', ('nosleep',)), ('disconnect', ())]:
            result = self.run_t3(action, *args, T3_HOST='g@fujitsu', DOTFILES_PROFILE='macos')
            self.assertEqual(result.returncode, 0, result.stderr)
            call = self.calls()[-1]
            self.assertEqual(call[:3] if action == 'disconnect' else call[:4],
                             ['ssh', '--', 'g@fujitsu'] if action == 'disconnect' else ['ssh', '-t', '--', 'g@fujitsu'])
            # Execute the payload under a clean shell, as on the SSH server.
            result = subprocess.run([str(self.bin / 'bash'), '-c', call[-1]],
                                    env=dict(self.env, DISPLAY=':0'), text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.calls()
        self.assertIn(['t3', 'connect', 'link', '--headless'], calls)
        self.assertTrue(any(call[0] == 'systemd-run' for call in calls))
        self.assertEqual(calls[-4:], [
            ['t3', 'connect', 'unlink'],
            ['systemctl', '--user', 'is-active', '--quiet', 't3code.service'],
            ['systemctl', '--user', 'restart', 't3code.service'],
            ['systemctl', '--user', 'show', 't3code-nosleep.service', '--property=LoadState', '--value'],
        ])

    def test_macos_t3_connect_restarts_through_launchd(self):
        self.assertEqual(self.run_t3('setup', DOTFILES_PROFILE='macos').returncode, 0)
        result = self.run_t3('connect', DOTFILES_PROFILE='macos')
        self.assertEqual(result.returncode, 0, result.stderr)
        target = f'gui/{os.getuid()}/com.dotfiles.t3code'
        self.assertEqual(self.calls()[1:], [
            self.T3_LINK_CHECK,
            ['t3', 'connect', 'link'],
            ['launchctl', 'print', target], ['launchctl', 'kickstart', '-k', target],
            self.T3_LINK_CHECK,
            ['t3', 'connect', 'status'],
        ])
        result = self.run_t3('connect', 'nosleep', DOTFILES_PROFILE='macos')
        self.assertEqual(result.returncode, 2)
        self.assertIn('Linux', result.stderr)

    def test_pair_mints_one_labelled_token_per_device(self):
        # A token is one-time, so a second device is a second call, and the
        # label is what tells the two apart in the server's own list.
        self.assertEqual(self.run_t3('pair').returncode, 0)
        result = self.run_t3('pair', 'phone', DOTFILES_PROFILE='macos')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Pairing URL:', result.stdout)
        self.assertEqual(self.calls(), [
            ['t3', 'pair', '--tailscale', '--tailscale-serve-port', '3773'],
            ['t3', 'pair', '--tailscale', '--tailscale-serve-port', '3773', '--label', 'phone'],
        ])

    def test_local_pairs_over_loopback_and_opens_the_browser(self):
        result = self.run_t3('local', DOTFILES_PROFILE='macos')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [
            ['t3', 'pair', '--label', 'local'],
            ['open', 'https://server:3773/#token=code'],
        ])

    def test_local_refuses_a_remote_host_and_a_failed_pairing(self):
        result = self.run_t3('local', T3_HOST='g@fujitsu')
        self.assertEqual(result.returncode, 2)
        self.assertIn('unset T3_HOST', result.stderr)
        self.assertEqual(self.calls(), [])
        # The fake opener fails alike, so a call to it would show in the log.
        self.assertEqual(self.run_t3('local', COMMAND_EXIT='1').returncode, 1)
        self.assertEqual(self.calls(), [['t3', 'pair', '--label', 'local']])

    def test_devices_lists_both_kinds_and_revoke_drops_an_id(self):
        self.assertEqual(self.run_t3('devices').returncode, 0)
        self.assertEqual(self.run_t3('revoke', 'ab12-34').returncode, 0)
        self.assertEqual(self.calls(), [
            ['t3', '--log-level', 'none', 'auth', 'session', 'list'],
            ['t3', '--log-level', 'none', 'auth', 'pairing', 'list'],
            ['t3', '--log-level', 'none', 'auth', 'session', 'revoke', 'ab12-34'],
            ['t3', '--log-level', 'none', 'auth', 'pairing', 'revoke', 'ab12-34'],
        ])

    def test_labels_and_ids_cannot_carry_a_command_to_a_server(self):
        for argument in ('a;touch /tmp/no', "a'b", 'a b', '$(id)', '--label'):
            result = self.run_t3('pair', argument, T3_HOST='g@fujitsu')
            self.assertEqual(result.returncode, 2, argument)
            self.assertIn('letters, digits', result.stderr)
            self.assertEqual(self.calls(), [])
        self.assertEqual(self.run_t3('revoke').returncode, 2)
        self.assertEqual(self.calls(), [])

    def test_pair_and_the_lists_reach_a_server_over_ssh(self):
        for action, args, terminal in [('pair', ('laptop',), True),
                                       ('devices', (), False),
                                       ('revoke', ('ab12-34',), False)]:
            self.assertEqual(self.run_t3(action, *args, T3_HOST='g@fujitsu').returncode, 0)
            call = self.calls()[-1]
            self.assertEqual(call[:4] if terminal else call[:3],
                             ['ssh', '-t', '--', 'g@fujitsu'] if terminal else ['ssh', '--', 'g@fujitsu'])
            payload = call[-1]
            self.assertIn('t3_cli ()', payload)
            # Execute the payload under a clean shell, as on the SSH server.
            result = subprocess.run([str(self.bin / 'bash'), '-c', payload],
                                    env=self.env, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([call for call in self.calls() if call[0] == 't3'], [
            ['t3', 'pair', '--tailscale', '--tailscale-serve-port', '3773', '--label', 'laptop'],
            ['t3', '--log-level', 'none', 'auth', 'session', 'list'],
            ['t3', '--log-level', 'none', 'auth', 'pairing', 'list'],
            ['t3', '--log-level', 'none', 'auth', 'session', 'revoke', 'ab12-34'],
            ['t3', '--log-level', 'none', 'auth', 'pairing', 'revoke', 'ab12-34'],
        ])

    def test_update_runs_the_updater_here_and_ships_it_to_a_server(self):
        # A machine with none of the tools installed updates nothing and,
        # having nothing to look up, reaches no network.
        result = self.run_t3('update', DOTFILES_PROFILE='macos')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('== T3 Code', result.stdout)
        self.assertIn('Not installed here, so not updated: claude, codex, gemini, agy',
                      result.stdout)
        self.assertEqual(self.calls(), [])

        result = self.run_t3('update', T3_HOST='g@fujitsu')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls(), [['ssh', '--', 'g@fujitsu', 'python3', '-']])

    def update_appimage(self, release):
        """Run the updater's AppImage step against a fake release, in this home."""
        script = (
            'import hashlib, importlib.util, sys\n'
            'spec = importlib.util.spec_from_file_location("t3_update", sys.argv[1])\n'
            'update = importlib.util.module_from_spec(spec); spec.loader.exec_module(update)\n'
            'content = sys.argv[2].encode()\n'
            'asset = {"name": "T3-Code-1-x86_64.AppImage", "browser_download_url": "url",\n'
            '         "digest": "sha256:" + hashlib.sha256(content).hexdigest()}\n'
            'update.latest_release = lambda repository: {"tag_name": "v1", "assets": [asset]}\n'
            'update.fetch = lambda url: content\n'
            'print("changed" if update.update_appimage() else "unchanged")\n')
        return subprocess.run(
            [sys.executable, '-c', script, str(ROOT / 'scripts/t3-update.py'), release],
            env=dict(self.env, PATH=str(self.bin)), text=True, capture_output=True)

    def test_update_refreshes_every_extracted_copy_left_stale(self):
        # The AppImage writes its own release into the copy it extracts.
        release = (f'#!{sys.executable}\n'
                   'from pathlib import Path\n'
                   'Path("squashfs-root").mkdir()\n'
                   'Path("squashfs-root/version").write_text(Path(__file__).read_text())\n')
        appimage = self.home / '.local/bin/t3-code'
        appimage.parent.mkdir(parents=True)
        appimage.write_text(release)
        appimage.chmod(0o755)
        # Already current, but the hand-installed wrapper's copy is older and
        # has no record of its source, as on the Fujitsu.
        legacy = self.home / '.local/opt/t3code/squashfs-root'
        legacy.mkdir(parents=True)
        (legacy / 'version').write_text('v0.0.40')
        result = self.update_appimage(release)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('already the installed AppImage', result.stdout)
        self.assertIn(f'Extract T3 v1 to {legacy}', result.stdout)
        self.assertTrue(result.stdout.endswith('changed\n'))
        self.assertEqual((legacy / 'version').read_text(), release)
        self.assertFalse((legacy.parent / 'squashfs-root.previous').exists())
        # The managed copy, never created here, is not created by an update.
        self.assertFalse((self.home / '.local/share/dotfiles/t3/appimage').exists())
        # Once recorded, a second update has nothing to do.
        result = self.update_appimage(release)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('Extract', result.stdout)
        self.assertTrue(result.stdout.endswith('unchanged\n'))

    def test_local_setup_is_opt_in_preserves_services_and_does_not_start_them(self):
        result = self.run_t3('setup', DOTFILES_PROFILE='fedora')
        self.assertEqual(result.returncode, 0, result.stderr)
        service = self.home / '.config/systemd/user/t3code.service'
        self.assertIn('ExecStart=/bin/sh', service.read_text())
        launcher = self.home / '.local/share/dotfiles/t3/server.sh'
        self.assertIn('serve --host 127.0.0.1 --port 3773 --no-browser', launcher.read_text())
        # npm's entry point, not the file behind it, which an update may move.
        self.assertIn(str(self.bin / 't3') + ' serve', launcher.read_text())
        self.assertIn('shell/common/init.sh', launcher.read_text())
        self.assertEqual(self.calls(), [['t3', '--help'], ['systemctl', '--user', 'daemon-reload']])
        # A second setup leaves the service alone, but refreshes the launcher
        # it generated: that is how a machine recovers from an update that
        # moved the CLI out from under a service still pointing at it.
        service.write_text('Existing Fujitsu service\n')
        launcher.write_text('stale\n')
        result = self.run_t3('setup', DOTFILES_PROFILE='debian-server')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Keeping existing service', result.stdout)
        self.assertEqual(service.read_text(), 'Existing Fujitsu service\n')
        self.assertIn('--host 127.0.0.1', launcher.read_text())
        # Reloading is for a service this just wrote, and it wrote none.
        self.assertNotIn(['systemctl', '--user', 'daemon-reload'], self.calls()[2:])

    def test_setup_records_the_npm_entry_point_not_the_file_behind_it(self):
        # npm's entry point is a symlink to an implementation file that a
        # release is free to move or to ship without an executable bit, as
        # t3 0.0.42 did; a service outliving the update has to point at the
        # entry point, which npm maintains.
        implementation = self.home / 'lib/node_modules/t3/bin/t3.js'
        implementation.parent.mkdir(parents=True)
        (self.bin / 't3').rename(implementation)
        (self.bin / 't3').symlink_to(implementation)
        result = self.run_t3('setup', DOTFILES_PROFILE='fedora')
        self.assertEqual(result.returncode, 0, result.stderr)
        launcher = (self.home / '.local/share/dotfiles/t3/server.sh').read_text()
        self.assertIn(str(self.bin / 't3') + ' serve', launcher)
        self.assertNotIn(str(implementation), launcher)

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
