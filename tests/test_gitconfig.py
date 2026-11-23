"""Tests for the aliases of git/.gitconfig, run against throwaway repositories."""

import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class BranchDeleteTests(unittest.TestCase):
    """`git bd` deletes merged branches, squash-merged ones and their worktrees included."""

    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix='dotfiles-gitconfig-')
        self.addCleanup(temp.cleanup)
        self.temp = Path(temp.name)
        global_config = self.temp / 'gitconfig'
        global_config.write_text(
            f'[include]\n  path = {ROOT / "git/.gitconfig"}\n'
            '[user]\n  name = Test\n  email = test@example.test\n'
            '[core]\n  pager = cat\n'
        )
        self.env = {
            **os.environ,
            'GIT_CONFIG_GLOBAL': str(global_config),
            'GIT_CONFIG_NOSYSTEM': '1',
        }
        self.repo = self.temp / 'repo'
        self.git('init', '-q', '-b', 'main', str(self.repo), cwd=self.temp)
        self.commit('base', 'base.txt')

    def git(self, *args, cwd=None):
        return subprocess.run(
            ['git', *args], cwd=cwd or self.repo, env=self.env, check=True, capture_output=True, text=True
        ).stdout

    def commit(self, message, name, cwd=None):
        path = Path(cwd or self.repo) / name
        path.write_text(message + '\n')
        self.git('add', name, cwd=cwd)
        self.git('commit', '-q', '-m', message, cwd=cwd)

    def branch_with_commits(self, branch, worktree=False):
        """Create a branch with two commits, in its own worktree when asked."""
        if worktree:
            cwd = self.temp / branch
            self.git('worktree', 'add', '-q', '-b', branch, str(cwd))
        else:
            cwd = self.repo
            self.git('switch', '-q', '-c', branch)
        self.commit(f'{branch} one', f'{branch}-1.txt', cwd=cwd)
        self.commit(f'{branch} two', f'{branch}-2.txt', cwd=cwd)
        if not worktree:
            self.git('switch', '-q', 'main')
        return cwd

    def squash_merge(self, branch):
        self.git('merge', '-q', '--squash', branch)
        self.git('commit', '-q', '-m', f'Squash {branch}')

    def branches(self):
        return set(self.git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split())

    def test_deletes_merged_and_squash_merged_branches_and_their_worktrees(self):
        self.branch_with_commits('fast-forwarded')
        self.git('merge', '-q', '--ff-only', 'fast-forwarded')
        squashed = self.branch_with_commits('squashed', worktree=True)
        self.squash_merge('squashed')
        self.branch_with_commits('squashed-plain')
        self.squash_merge('squashed-plain')
        # main moves on after the squash merges.
        self.commit('later', 'later.txt')
        unmerged = self.branch_with_commits('unmerged', worktree=True)

        self.git('bd')

        self.assertEqual(self.branches(), {'main', 'unmerged'})
        self.assertFalse(squashed.exists())
        self.assertTrue(unmerged.exists())

    def test_keeps_a_squash_merged_branch_with_later_work_or_a_dirty_worktree(self):
        extended = self.branch_with_commits('extended')
        self.squash_merge('extended')
        self.git('switch', '-q', 'extended')
        self.commit('after the merge', 'extended-3.txt', cwd=extended)
        self.git('switch', '-q', 'main')
        dirty = self.branch_with_commits('dirty', worktree=True)
        self.squash_merge('dirty')
        (dirty / 'untracked.txt').write_text('work in progress\n')

        self.git('bd')

        self.assertEqual(self.branches(), {'main', 'extended', 'dirty'})
        self.assertTrue(dirty.exists())


if __name__ == '__main__':
    unittest.main()
