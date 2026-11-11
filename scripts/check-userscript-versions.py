#!/usr/bin/env python3
"""Fail when a userscript changed without a higher `@version`.

    python3 scripts/check-userscript-versions.py BASE         # working tree against BASE
    python3 scripts/check-userscript-versions.py BASE HEAD    # commit HEAD against BASE

Violentmonkey and Greasy Fork only pick up a new copy of a script when its
`@version` grows, so an edit published under the old number never reaches the
browsers that already installed it. Every file of `userscripts/` that differs
from the merge base of BASE and HEAD must therefore carry a higher `@version`
than it had there. New scripts are not checked.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PATTERN = 'userscripts/*.user.js'
VERSION = re.compile(r'^// @version[ \t]+(\S+)', re.MULTILINE)


def git(*args):
    return subprocess.run(('git', *args), cwd=ROOT, check=True, capture_output=True, text=True).stdout


def version_of(source):
    """Return the `@version` of a userscript, or None when its header has none."""
    header = source.split('==/UserScript==', 1)[0]
    match = VERSION.search(header)
    return match.group(1) if match else None


def version_key(version):
    """Order versions part by part: 1.10.0 is above 1.9.3, and 1.2 equals 1.2.0."""
    key = []
    for part in version.split('.'):
        digits, rest = re.fullmatch(r'(\d*)(.*)', part).groups()
        key.append((int(digits or 0), rest))
    while key and key[-1] == (0, ''):
        key.pop()
    return key


def problems(base, head=None):
    """List the userscripts changed since `base` whose `@version` did not grow."""
    start = git('merge-base', base, head or 'HEAD').strip()
    revisions = (start, head) if head else (start,)
    changed = git('diff', '--name-only', '--no-renames', '--diff-filter=M', *revisions, '--', PATTERN).split()
    found = []
    for path in changed:
        old = version_of(git('show', f'{start}:{path}'))
        new = version_of(git('show', f'{head}:{path}') if head else (ROOT / path).read_text())
        if new is None:
            found.append(f'{path}: no @version in its header')
        elif old is not None and version_key(new) <= version_key(old):
            found.append(f'{path}: changed, but @version is still {new} (was {old})')
    return found


def main(argv):
    if len(argv) not in (1, 2):
        print('Usage: python3 scripts/check-userscript-versions.py BASE [HEAD]', file=sys.stderr)
        return 2
    try:
        found = problems(*argv)
    except subprocess.CalledProcessError as error:
        print(f'scripts/check-userscript-versions.py: {error.stderr.strip()}', file=sys.stderr)
        return 2
    for problem in found:
        print(problem, file=sys.stderr)
    if found:
        print('Raise the @version of each userscript listed above.', file=sys.stderr)
        return 1
    print('Every changed userscript has a higher @version.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
