"""Offline regression tests. No packages installed and no real dotfiles touched."""
import argparse
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('installer', ROOT / 'scripts/install.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='dotfiles-test-')
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name) / "user's home é"
        self.home.mkdir()
        self.args = argparse.Namespace(home=self.home, profile='debian-server',
                                       apply=True, only=['shell'], firefox_policy=False)
        self.install = installer.Installer(self.args)
        self.install.identity = self.home / '.gitconfig.local'
        self.output = io.StringIO()
        self.silence = contextlib.redirect_stdout(self.output)
        self.silence.__enter__()
        self.addCleanup(self.silence.__exit__, None, None, None)

    def shell(self):
        if not self.install.identity.exists():
            self.install.identity.write_text(
                '[user]\n  name = "Test User"\n  email = "preserved@example.test"\n\n'
                '[github]\n  user = "github-test"\n\n'
                '[gitlab]\n  user = "gitlab-test"\n\n'
                '[bitbucket]\n  user = "bitbucket-test"\n'
            )
        with patch.object(self.install, 'run'):
            self.install.shell()

    def test_all_manifests_parse(self):
        for path in (ROOT / 'profiles').rglob('*.yaml'):
            with self.subTest(path=path):
                self.assertTrue(installer.manifest(path))

    def test_manifest_rejects_unsupported_yaml(self):
        path = self.home / 'bad.yaml'
        for text in ('native:\n  - foo # inline\n', 'native:\n  - {a: b}\n', 'native:\nnative:\n'):
            path.write_text(text)
            with self.assertRaises(ValueError):
                installer.manifest(path)

    def test_every_profile_dry_run_is_offline_and_read_only(self):
        for profile in installer.PROFILES:
            with self.subTest(profile=profile), patch.object(installer, 'fetch', side_effect=AssertionError('network')), patch.object(installer.subprocess, 'run', side_effect=AssertionError('process')):
                self.args.profile = profile
                self.args.apply = False
                self.args.only = list(installer.STEPS)
                self.assertEqual(installer.Installer(self.args).execute(), 0)
                self.assertEqual(list(self.home.iterdir()), [])

    def test_server_plan_excludes_desktop_and_daemon_install(self):
        native = self.install.profile['native']
        for name in ('flatpak', 'firefox', 'codium', 'docker', 'openssh-server'):
            self.assertNotIn(name, native)
        with patch.object(self.install, 'run') as run:
            self.install.extensions()
            self.install.browsers()
        run.assert_not_called()
        self.assertFalse(self.install.config.exists())

    def test_t3_install_strategy_is_profile_specific(self):
        packages = installer.manifest(ROOT / 'profiles/common/npm-packages.yaml')
        self.assertIn('t3', packages['macos'])
        self.assertIn('t3', packages['fedora'])
        self.assertNotIn('t3', packages['debian-server'])
        self.assertTrue(any('pingdotgg/t3code' in item for item in self.install.profile['binary-releases']))

    def test_vendor_repositories_precede_tailscale_install_without_enrollment(self):
        for profile in ('debian-server', 'fedora'):
            with self.subTest(profile=profile):
                self.args.profile = profile
                install = installer.Installer(self.args)
                with patch.object(installer, 'fetch', return_value=b'repository data'), \
                        patch.object(install, 'run', return_value='') as run:
                    install.vendor_packages()
                calls = [call.args for call in run.call_args_list]
                package_call = next(i for i, call in enumerate(calls)
                                    if call[:3] in (('sudo', 'apt-get', 'install'), ('sudo', 'dnf', 'install')))
                repository_calls = [i for i, call in enumerate(calls) if call[:2] == ('sudo', 'install')]
                self.assertTrue(repository_calls)
                self.assertLess(max(repository_calls), package_call)
                self.assertIn('tailscale', calls[package_call])
                self.assertEqual(calls[-1], ('sudo', 'systemctl', 'enable', '--now', 'tailscaled'))
                self.assertFalse(any(call[:2] == ('sudo', 'tailscale') for call in calls))

    def test_macos_packages_unlink_old_openssh_after_upgrades(self):
        ssh_config = self.home / '.ssh/config'
        ssh_config.parent.mkdir()
        content = 'Host github.com\n  AddKeysToAgent yes\n  UseKeychain yes\n  IdentityFile ~/.ssh/id_ed25519\n'
        ssh_config.write_text(content)
        for update in (False, True):
            for installed in ('git\nopenssh\n', 'git\n'):
                with self.subTest(update=update, installed=installed):
                    self.args.profile = 'macos'
                    self.args.update = update
                    install = installer.Installer(self.args)

                    def run(*argv, **kwargs):
                        return installed if argv[1:] == ('list', '--formula') else ''

                    with patch.object(installer.shutil, 'which', return_value='/opt/homebrew/bin/brew'), \
                            patch.object(install, 'run', side_effect=run) as calls, \
                            patch.object(install, 'node'):
                        install.packages()
                    commands = [call.args for call in calls.call_args_list]
                    unlink = ('/opt/homebrew/bin/brew', 'unlink', 'openssh')
                    if 'openssh' in installed:
                        self.assertIn(unlink, commands)
                        upgrades = [i for i, call in enumerate(commands) if call[1] == 'upgrade']
                        self.assertGreater(commands.index(unlink), max(upgrades))
                    else:
                        self.assertNotIn(unlink, commands)
                    self.assertEqual(ssh_config.read_text(), content)

    def test_private_identity_is_prompted_and_written(self):
        answers = iter(('Test User', 'test@example.test', 'octocat', 'gitlabcat', 'bucketcat'))
        with patch.object(installer.sys.stdin, 'isatty', return_value=True), \
             patch('builtins.input', side_effect=lambda _: next(answers)):
            self.install.ensure_identity()
        content = self.install.identity.read_text()
        self.assertIn('email = "test@example.test"', content)
        self.assertIn('user = "octocat"', content)
        self.assertEqual(self.install.identity.stat().st_mode & 0o777, 0o600)

    def test_missing_identity_requires_an_interactive_terminal(self):
        with patch.object(installer.sys.stdin, 'isatty', return_value=False), self.assertRaisesRegex(ValueError, 'interactive terminal'):
            self.install.ensure_identity()
        self.assertFalse(self.install.identity.exists())

    def test_update_selects_package_apply_mode(self):
        observed = {}
        with patch.object(installer, 'detect_profile', return_value='debian-server'), \
             patch.object(installer.Installer, 'execute', autospec=True,
                          side_effect=lambda instance: observed.update(vars(instance.args)) or 0):
            self.assertEqual(installer.main(['--update']), 0)
        self.assertTrue(observed['apply'])
        self.assertTrue(observed['update'])
        self.assertEqual(observed['only'], ['packages'])

    def test_write_backs_up_without_touching_symlink_target(self):
        source = self.home / 'original'
        source.write_text('keep me')
        target = self.home / '.zshrc'
        target.symlink_to(source)
        self.install.write(target, 'replacement')
        self.assertFalse(target.is_symlink())
        self.assertEqual(source.read_text(), 'keep me')
        backups = list((self.install.data / 'backups').iterdir())
        self.assertEqual(len(backups), 1)
        self.assertEqual(backups[0].read_text(), 'keep me')
        self.assertEqual(backups[0].stat().st_mode & 0o777, 0o600)
        self.install.write(target, 'replacement')
        self.assertEqual(len(list((self.install.data / 'backups').iterdir())), 1)

    def test_directory_and_malformed_block_are_not_overwritten(self):
        with self.assertRaises(ValueError):
            self.install.write(self.home, 'bad')
        rc = self.home / '.bashrc'
        rc.write_text('# >>> dotfiles managed >>>\nkeep this\n')
        with self.assertRaises(ValueError):
            self.install.hook(rc, 'new')
        self.assertIn('keep this', rc.read_text())

    def test_shell_is_idempotent_and_preserves_user_settings(self):
        rc = self.home / '.bashrc'
        rc.write_text('# user settings\nexport MY_SETTING=kept\n')
        (self.home / '.gitconfig').write_text('[user]\n  email = old@example.test\n')
        self.shell()
        snapshot = {p.relative_to(self.home): p.read_bytes() for p in self.home.rglob('*') if p.is_file()}
        self.shell()
        self.assertEqual(snapshot, {p.relative_to(self.home): p.read_bytes() for p in self.home.rglob('*') if p.is_file()})
        self.assertIn('MY_SETTING=kept', rc.read_text())
        self.assertEqual(rc.read_text().count('# >>> dotfiles environment >>>'), 1)
        config = self.home / '.gitconfig'
        env = dict(os.environ, HOME=str(self.home), GIT_CONFIG_NOSYSTEM='1')
        for key, expected in (('user.email', 'preserved@example.test'), ('core.editor', 'vim'), ('core.excludesFile', str(ROOT / 'git/.gitignore_global'))):
            result = subprocess.run(['git', 'config', '--file', str(config), '--includes', '--get', key], env=env, text=True, capture_output=True, check=True)
            self.assertEqual(result.stdout.strip(), expected)
        self.assertNotIn('[user]', (ROOT / 'git/.gitconfig').read_text())

    def test_new_bash_login_preserves_distribution_profile(self):
        (self.home / '.profile').write_text('export FROM_PROFILE=preserved\n')
        self.shell()
        result = self.bash('. "$HOME/.bash_profile"; printf "%s" "$FROM_PROFILE"')
        self.assertEqual(result.stdout, 'preserved')

    def test_desktop_git_settings_are_quoted_and_profile_specific(self):
        for profile, editor, gui in (('macos', 'code --wait', '!open -a "GitHub Desktop"'),
                                     ('fedora', 'codium --wait', '!github-desktop')):
            self.args.profile = profile
            self.shell()
            for key, expected in (('core.editor', editor), ('alias.k', gui)):
                result = subprocess.run(['git', 'config', '--file', str(self.install.config / 'gitconfig'), '--get', key], text=True, capture_output=True, check=True)
                self.assertEqual(result.stdout.strip(), expected)

    def test_migration_of_exact_legacy_template(self):
        rc = self.home / '.zshenv'
        legacy = 'export ZDOTDIR="$HOME/Documents/prog/dotfiles/run"\n'
        rc.write_text(legacy)
        with patch.dict(installer.LEGACY_HASHES, {'.zshenv': hashlib.sha256(legacy.encode()).hexdigest()}):
            self.shell()
        self.assertNotIn('ZDOTDIR', rc.read_text())
        self.assertIn(legacy, [p.read_text() for p in (self.install.data / 'backups').iterdir()])

    def test_custom_zdotdir_is_blocked_before_writes(self):
        (self.home / '.zshenv').write_text('export ZDOTDIR="$HOME/custom-zsh"\n')
        with self.assertRaises(ValueError):
            self.shell()
        self.assertFalse(self.install.config.exists())

    def test_legacy_bash_with_appended_settings_and_managed_blocks_migrates(self):
        legacy = (ROOT / 'scripts/legacy/bash_profile.bash').read_text()
        for filename in ('.bashrc', '.bash_profile'):
            path = self.home / filename
            original = ('# >>> dotfiles environment >>>\nDOTFILES_DIR=.\n'
                        '# <<< dotfiles environment <<<\n' + legacy +
                        '\nexport PERSONAL_SETTING=preserved\n')
            path.write_text(original)
        self.args.profile = 'macos'
        self.shell()
        for filename in ('.bashrc', '.bash_profile'):
            text = (self.home / filename).read_text()
            self.assertNotIn('for completion_file', text)
            self.assertNotIn('CURRENT_SCRIPT=', text)
            self.assertIn('PERSONAL_SETTING=preserved', text)
            result = self.bash('. "$HOME/' + filename + '"; alias g; printf "%s" "$PERSONAL_SETTING"', interactive=True)
            self.assertIn("alias g='git'", result.stdout)
            self.assertTrue(result.stdout.endswith('preserved'))
            self.assertNotIn('command not found', result.stderr)
            self.assertNotIn('No such file', result.stderr)
        self.assertIn(original, [p.read_text() for p in (self.install.data / 'backups').iterdir()])
        snapshot = (self.home / '.bashrc').read_text()
        self.shell()
        self.assertEqual(snapshot, (self.home / '.bashrc').read_text())

    def test_modified_legacy_bash_resolver_is_detected_before_writes(self):
        (self.home / '.bashrc').write_text('for DOTFILE in "$DOTFILES_DIR"/system/{env,alias}.sh; do\n  . "$DOTFILE"\ndone\n')
        with self.assertRaisesRegex(ValueError, 'customized legacy'):
            self.shell()
        self.assertFalse(self.install.config.exists())

    def test_bash_restores_checkout_path_after_user_startup(self):
        (self.home / '.bashrc').write_text('DOTFILES_DIR=.\n')
        self.shell()
        result = self.bash('. "$HOME/.bashrc"; alias g; printf "%s" "$DOTFILES_DIR"', interactive=True)
        self.assertIn("alias g='git'", result.stdout)
        self.assertTrue(result.stdout.endswith(str(ROOT)))
        self.assertNotIn('No such file', result.stderr)

    def test_bash_integrations_require_a_supported_shell_version(self):
        self.args.profile = 'macos'
        fake_bin = self.home / 'bin'
        fake_bin.mkdir()
        for tool in ('fnm', 'fzf', 'zoxide', 'starship', 'atuin', 'kubectl'):
            path = fake_bin / tool
            path.write_text("#!/bin/sh\nprintf '%s\\n' 'export MODERN_INTEGRATION_CALLED=yes'\n")
            path.chmod(0o755)
        completion = self.home / 'brew/etc/profile.d/bash_completion.sh'
        completion.parent.mkdir(parents=True)
        completion.write_text('FRAMEWORK_CALLED=yes\n')
        result = self.bash(
            'PATH="$HOME/bin:$PATH"; HOMEBREW_PREFIX="$HOME/brew"; '
            '. "$DOTFILES_DIR/shell/interactive/init.bash"; '
            'printf "%s:%s:%s:%s" "${BASH_VERSINFO[0]}" "${BASH_VERSINFO[1]}" '
            '"${FRAMEWORK_CALLED:-no}" "${MODERN_INTEGRATION_CALLED:-no}"', interactive=True)
        major, minor, framework, integration = result.stdout.split(':')
        expected = 'yes' if (int(major), int(minor)) >= (4, 2) else 'no'
        self.assertEqual((framework, integration), (expected, expected))

    def bash(self, command, interactive=False):
        env = dict(HOME=str(self.home), PATH='/usr/bin:/bin', TERM='dumb',
                   DOTFILES_DIR=str(ROOT), DOTFILES_PROFILE=self.args.profile)
        binary = os.environ.get('DOTFILES_TEST_BASH', 'bash')
        result = subprocess.run([binary, '--noprofile', '--norc', '-ic' if interactive else '-c', command],
                                env=env, text=True, capture_output=True, check=True)
        return result

    def test_ssh_bash_environment_precedes_early_return(self):
        (self.home / '.bashrc').write_text('case $- in *i*) ;; *) return ;; esac\n')
        self.shell()
        result = self.bash('. "$HOME/.bashrc"; printf "%s:%s" "$DOTFILES_PROFILE" "$EDITOR"; alias g 2>/dev/null || :')
        self.assertEqual(result.stdout, 'debian-server:vim')
        self.assertEqual(result.stderr, '')

    def test_common_environment_is_silent_and_path_is_idempotent(self):
        node = self.home / '.local/share/fnm/node-versions/v24/bin'
        node.mkdir(parents=True)
        self.install.write(self.install.config / 'node-path.sh', 'dotfiles_prepend_path ' + shlex.quote(str(node)) + '\n')
        command = '. "$DOTFILES_DIR/shell/common/init.sh"; old_path=$PATH; . "$DOTFILES_DIR/shell/common/init.sh"; test "$PATH" = "$old_path"; printf "%s" "$PATH"'
        result = self.bash(command)
        self.assertTrue(result.stdout.startswith(str(node) + ':'))
        self.assertEqual(result.stderr, '')

    def test_existing_node_path_is_moved_ahead_of_other_managers(self):
        node = self.home / 'node bin'
        node.mkdir()
        self.install.write(self.install.config / 'node-path.sh', 'dotfiles_prepend_path ' + shlex.quote(str(node)) + '\n')
        result = self.bash('PATH="/bin:' + str(node) + ':/usr/bin"; . "$DOTFILES_DIR/shell/common/init.sh"; printf "%s" "$PATH"')
        self.assertTrue(result.stdout.startswith(str(node) + ':'))
        self.assertEqual(result.stdout.count(str(node)), 1)

    def test_pnpm_install_uses_fnm_even_with_an_inherited_npm_prefix(self):
        node_bin = self.home / '.local/share/fnm/node-versions/v24/installation/bin'
        node_bin.mkdir(parents=True)
        self.install.common['agents'] = []
        self.install.common['debian-server-agents'] = []
        self.install.env['npm_config_prefix'] = str(self.home / '.volta')
        self.install.env['NPM_CONFIG_PREFIX'] = str(self.home / 'old-global')
        observed = []

        def run(*argv, **kwargs):
            if argv[:2] == ('fnm', 'exec'):
                return str(node_bin / 'node') + '\n'
            if argv[0] == 'npm':
                observed.append((argv, self.install.env.copy()))
            return ''

        with patch.object(self.install, 'run', side_effect=run):
            self.install.node()
        self.assertEqual(len(observed), 1)
        argv, env = observed[0]
        self.assertIn('pnpm', argv)
        self.assertEqual(env['PATH'].split(os.pathsep)[0], str(node_bin))
        self.assertEqual(env['npm_config_prefix'], str(node_bin.parent))
        self.assertNotIn('NPM_CONFIG_PREFIX', env)
        result = self.bash('. "$DOTFILES_DIR/shell/common/init.sh"; printf "%s" "$PATH"')
        self.assertTrue(result.stdout.startswith(str(node_bin) + ':'))

    def zsh(self, interactive=False):
        binary = os.environ.get('DOTFILES_TEST_ZSH') or shutil.which('zsh')
        if not binary:
            self.skipTest('zsh is not installed; set DOTFILES_TEST_ZSH to an isolated binary')
        prefix = ''
        extracted = os.environ.get('DOTFILES_TEST_ZSH_ROOT')
        if extracted:
            # Optional extracted Debian packages, without installing anything.
            prefix = 'module_path=(' + shlex.quote(extracted) + '/usr/lib/*/zsh/5.9 $module_path); fpath=(' + shlex.quote(extracted) + '/usr/share/zsh/functions/**/*(/N) $fpath); '
        self.shell()
        command = prefix + '. "$HOME/.zshenv"; . "$HOME/.zshrc"; '
        command += 'alias g rp' if interactive else 'printf "%s:%s" "$DOTFILES_PROFILE" "$EDITOR"; (( ! $+aliases[g] ))'
        env = dict(HOME=str(self.home), PATH='/usr/bin:/bin', TERM='dumb')
        return subprocess.run([binary, '-f', '-ic' if interactive else '-c', command],
                              env=env, text=True, capture_output=True, check=True)

    def test_noninteractive_zsh_is_silent_except_requested_output(self):
        result = self.zsh()
        self.assertEqual(result.stdout, 'debian-server:vim')
        self.assertEqual(result.stderr, '')

    def test_interactive_zsh_loads_completions_and_linux_aliases(self):
        result = self.zsh(interactive=True)
        self.assertIn('g=git', result.stdout)
        self.assertIn("rp='ss -ltnp'", result.stdout)
        self.assertEqual(result.stderr, '')

    def test_interactive_bash_has_common_and_linux_aliases(self):
        result = self.bash('. "$DOTFILES_DIR/shell/common/init.sh"; . "$DOTFILES_DIR/shell/interactive/init.bash"; alias g rp; ! alias b 2>/dev/null', interactive=True)
        self.assertIn("alias g='git'", result.stdout)
        self.assertIn("alias rp='ss -ltnp'", result.stdout)

    def test_macos_bash_startup_loads_all_reported_aliases(self):
        self.args.profile = 'macos'
        self.shell()
        for filename in ('.bashrc', '.bash_profile'):
            with self.subTest(filename=filename):
                result = self.bash('. "$HOME/' + filename + '"; alias d nx p nr', interactive=True)
                for name, command in (('d', 'docker'), ('nx', 'pnpm exec nx'),
                                      ('p', 'pnpm'), ('nr', 'npm run')):
                    self.assertIn(f"alias {name}='{command}'", result.stdout)

    def test_archive_extraction_does_not_follow_paths_or_links(self):
        archive = self.home / 'test.tar.gz'
        with tarfile.open(archive, 'w:gz') as stream:
            symlink = tarfile.TarInfo('tool')
            symlink.type = tarfile.SYMTYPE
            symlink.linkname = '/etc/passwd'
            stream.addfile(symlink)
            regular = tarfile.TarInfo('../../tool')
            regular.size = 4
            stream.addfile(regular, io.BytesIO(b'safe'))
        self.assertEqual(installer.extract_binary(archive, 'tool'), b'safe')
        self.assertFalse((self.home / 'tool').exists())
        with zipfile.ZipFile(self.home / 'test.zip', 'w') as stream:
            stream.writestr('a/tool', b'first')
            stream.writestr('b/tool', b'second')
        with self.assertRaises(ValueError):
            installer.extract_binary(self.home / 'test.zip', 'tool')

    def test_checksum_mismatch_stops_before_install(self):
        metadata = {'assets': [{'name': 'tool', 'browser_download_url': 'https://example.test/tool',
                                'digest': 'sha256:' + '0' * 64}]}
        with patch.object(installer, 'fetch', side_effect=[json.dumps(metadata).encode(), b'bad']), self.assertRaisesRegex(ValueError, 'Checksum mismatch'):
            self.install.release('example/tool tool tool')
        self.assertFalse(self.install.bin.exists())

    def test_browser_extensions_are_profile_specific(self):
        self.args.profile = 'fedora'
        self.install.browsers()
        page = (self.install.config / 'browser-extensions.html').read_text()
        self.assertIn('/switchyard/', page)
        self.assertNotIn('chromewebstore', page)
        self.args.profile = 'macos'
        self.install.browsers()
        page = (self.install.config / 'browser-extensions.html').read_text()
        self.assertNotIn('/switchyard/', page)
        self.assertIn('jhkfjpfhioaoopiapaipleecedggpimi', page)
        self.assertIn('jdkfjefccncegmcelnnbfmmibppjchgi', page)


if __name__ == '__main__':
    unittest.main()
