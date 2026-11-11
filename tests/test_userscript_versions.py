"""Test the userscript version check against throwaway Git repositories."""
import contextlib
import importlib.util
import io
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    'check_userscript_versions', Path(__file__).resolve().parent.parent / 'scripts/check-userscript-versions.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def script(version, body='run();'):
    return f'// ==UserScript==\n// @name         Demo\n// @version      {version}\n// ==/UserScript==\n{body}\n'


class UserscriptVersionTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        (self.root / 'userscripts').mkdir()
        patcher = patch.object(check, 'ROOT', self.root)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.git('init', '--quiet', '--initial-branch=main')
        self.write('demo.user.js', script('1.9.3'))
        self.commit('first')

    def git(self, *args):
        identity = ('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false')
        subprocess.run(('git', *identity, *args), cwd=self.root, check=True, capture_output=True)

    def write(self, name, source):
        (self.root / 'userscripts' / name).write_text(source)

    def commit(self, message):
        self.git('add', '--all')
        self.git('commit', '--quiet', '--message', message)

    def test_versions_are_ordered_part_by_part(self):
        self.assertGreater(check.version_key('1.10.0'), check.version_key('1.9.3'))
        self.assertEqual(check.version_key('1.2'), check.version_key('1.2.0'))
        self.assertGreater(check.version_key('2.0'), check.version_key('1.99.99'))

    def test_only_the_header_declares_the_version(self):
        self.assertEqual(check.version_of(script('1.2.3')), '1.2.3')
        self.assertIsNone(check.version_of('// ==UserScript==\n// ==/UserScript==\n// @version      9.9.9\n'))

    def test_a_change_without_a_higher_version_is_reported(self):
        self.write('demo.user.js', script('1.9.3', 'changed();'))
        self.assertEqual(check.problems('main'), ['userscripts/demo.user.js: changed, but @version is still 1.9.3 (was 1.9.3)'])
        self.write('demo.user.js', script('1.9.2', 'changed();'))
        self.assertEqual(len(check.problems('main')), 1)

    def test_a_change_with_a_higher_version_passes(self):
        self.write('demo.user.js', script('1.10.0', 'changed();'))
        self.assertEqual(check.problems('main'), [])

    def test_new_and_untouched_scripts_are_not_checked(self):
        self.write('other.user.js', script('0.1.0'))
        self.git('add', '--all')
        self.assertEqual(check.problems('main'), [])

    def test_two_commits_are_compared_from_their_merge_base(self):
        self.git('switch', '--quiet', '--create', 'topic')
        self.write('demo.user.js', script('1.9.3', 'changed();'))
        self.commit('edit without a bump')
        self.assertEqual(len(check.problems('main', 'topic')), 1)
        self.write('demo.user.js', script('1.9.4', 'changed();'))
        self.commit('bump')
        self.assertEqual(check.problems('main', 'topic'), [])
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(check.main(['main', 'topic']), 0)

    def test_an_unknown_base_is_an_error(self):
        with contextlib.redirect_stderr(io.StringIO()) as stderr:
            self.assertEqual(check.main(['no-such-ref']), 2)
        self.assertIn('no-such-ref', stderr.getvalue())


if __name__ == '__main__':
    unittest.main()
