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
            # Lets the tests add submodules from local repositories.
            '[protocol "file"]\n  allow = always\n'
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

    def commit(self, message, name, cwd=None, content=None):
        path = Path(cwd or self.repo) / name
        path.write_text((message if content is None else content) + '\n')
        self.git('add', name, cwd=cwd)
        self.git('commit', '-q', '-m', message, cwd=cwd)

    def branch_with_commits(self, branch, worktree=False, start='HEAD'):
        """Create a branch with two commits, in its own worktree when asked."""
        if worktree:
            cwd = self.temp / branch
            self.git('worktree', 'add', '-q', '-b', branch, str(cwd), start)
        else:
            cwd = self.repo
            self.git('switch', '-q', '-c', branch, start)
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

    def squash_merged_worktree_with_submodule(self, branch):
        """Squash-merge a branch whose worktree has a submodule checked out, itself with one."""
        for name in ('inner', 'library'):
            self.git('init', '-q', '-b', 'main', str(self.temp / name), cwd=self.temp)
            self.commit(name, f'{name}.txt', cwd=self.temp / name)
        self.git('submodule', 'add', '-q', '../inner', 'inner', cwd=self.temp / 'library')
        self.git('commit', '-q', '-m', 'Add inner', cwd=self.temp / 'library')
        self.git('submodule', 'add', '-q', '../library', 'library')
        self.git('commit', '-q', '-m', 'Add library')
        worktree = self.branch_with_commits(branch, worktree=True)
        self.git('submodule', 'update', '-q', '--init', '--recursive', cwd=worktree)
        self.squash_merge(branch)
        return worktree

    def test_deletes_a_squash_merged_branch_whose_worktree_has_submodules(self):
        worktree = self.squash_merged_worktree_with_submodule('with-submodule')

        self.git('bd')

        self.assertEqual(self.branches(), {'main'})
        self.assertFalse(worktree.exists())

    def test_keeps_a_worktree_with_a_dirty_nested_submodule(self):
        worktree = self.squash_merged_worktree_with_submodule('dirty-submodule')
        (worktree / 'library/inner/untracked.txt').write_text('work in progress\n')

        self.git('bd')

        self.assertEqual(self.branches(), {'main', 'dirty-submodule'})
        self.assertTrue(worktree.exists())

    def test_keeps_a_worktree_whose_submodule_has_unpushed_commits(self):
        worktree = self.squash_merged_worktree_with_submodule('unpushed-submodule')
        library = worktree / 'library'
        # A commit on a local branch, with the recorded commit checked out again afterwards.
        self.git('switch', '-q', '-c', 'feature', cwd=library)
        self.commit('unpushed', 'unpushed.txt', cwd=library)
        self.git('switch', '-q', '--detach', 'HEAD~1', cwd=library)

        self.git('bd')

        self.assertEqual(self.branches(), {'main', 'unpushed-submodule'})
        self.assertTrue(worktree.exists())

    def test_keeps_a_worktree_whose_submodule_has_a_stash(self):
        worktree = self.squash_merged_worktree_with_submodule('stashed-submodule')
        library = worktree / 'library'
        (library / 'library.txt').write_text('stashed\n')
        self.git('stash', '-q', cwd=library)

        self.git('bd')

        self.assertEqual(self.branches(), {'main', 'stashed-submodule'})
        self.assertTrue(worktree.exists())

    def test_deletes_a_worktree_whose_submodule_only_has_t3_checkpoints(self):
        worktree = self.squash_merged_worktree_with_submodule('checkpointed-submodule')
        library = worktree / 'library'
        # T3 snapshots the working tree in commits kept only under refs/t3/.
        tree = self.git('write-tree', cwd=library).strip()
        checkpoint = self.git('commit-tree', tree, '-p', 'HEAD', '-m', 't3 checkpoint', cwd=library).strip()
        self.git('update-ref', 'refs/t3/checkpoints/thread/ordinal/0', checkpoint, cwd=library)

        self.git('bd')

        self.assertEqual(self.branches(), {'main'})
        self.assertFalse(worktree.exists())

    def test_keeps_a_worktree_whose_deinitialized_submodule_has_unpushed_commits(self):
        worktree = self.squash_merged_worktree_with_submodule('deinitialized-submodule')
        library = worktree / 'library'
        self.git('switch', '-q', '-c', 'feature', cwd=library)
        self.commit('unpushed', 'unpushed.txt', cwd=library)
        self.git('switch', '-q', '--detach', 'HEAD~1', cwd=library)
        self.git('submodule', 'deinit', '-q', '--force', 'library', cwd=worktree)

        self.git('bd')

        self.assertEqual(self.branches(), {'main', 'deinitialized-submodule'})
        self.assertTrue(worktree.exists())

    def test_deletes_a_merged_branch_whose_worktree_directory_is_missing(self):
        worktree = self.branch_with_commits('moved', worktree=True)
        self.git('merge', '-q', '--ff-only', 'moved')
        worktree.rename(self.temp / 'moved-aside')

        self.git('bd')

        self.assertEqual(self.branches(), {'main'})

    def test_wt_remove_resolves_a_relative_path_from_the_current_directory(self):
        (self.repo / 'subdir').mkdir()
        self.git('worktree', 'add', '-q', '-b', 'at-root', 'pick')
        self.git('worktree', 'add', '-q', '-b', 'in-subdir', 'subdir/pick')

        self.git('wt-remove', 'pick', cwd=self.repo / 'subdir')

        self.assertTrue((self.repo / 'pick').exists())
        self.assertFalse((self.repo / 'subdir/pick').exists())

    def test_deletes_a_stacked_branch_squash_merged_in_parts(self):
        self.branch_with_commits('first')
        self.branch_with_commits('second', start='first')
        self.squash_merge('first')
        self.squash_merge('second')

        self.git('bd')

        self.assertEqual(self.branches(), {'main'})

    def test_deletes_a_squash_merged_branch_whose_lines_main_changed_since(self):
        self.git('switch', '-q', '-c', 'edited')
        self.commit('topic', 'base.txt')
        self.git('switch', '-q', 'main')
        self.squash_merge('edited')
        self.commit('changed again on main', 'base.txt')

        self.git('bd')

        self.assertEqual(self.branches(), {'main'})

    def test_keeps_a_branch_whose_change_differs_from_main_only_in_whitespace(self):
        self.git('switch', '-q', '-c', 'spaced')
        self.commit('topic', 'value.txt', content='value = "a b"')
        self.git('switch', '-q', 'main')
        self.commit('main', 'value.txt', content='value = "ab"')

        self.git('bd')

        self.assertEqual(self.branches(), {'main', 'spaced'})

    def test_squash_merges_count_only_from_a_main_branch(self):
        self.branch_with_commits('topic')
        self.git('switch', '-q', '-c', 'integration')
        self.squash_merge('topic')

        self.git('bd')

        self.assertEqual(self.branches(), {'main', 'integration', 'topic'})


if __name__ == '__main__':
    unittest.main()
