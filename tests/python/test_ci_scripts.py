"""tools/ci/correction.sh: the shell of apply-correction.yml, run against a repository
this makes rather than discovered on a runner forty minutes in.

Each test builds a small git repository with a `main` and a `correction/x` branch, plays
the situation the workflow has to tell apart -- a pushed correction, a merge commit that
brings corrections/ in, a branch that already carries its fix, a session that edited the
correction it was applying -- and reads what the script prints.
"""
import os
import subprocess

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SH = os.path.join(ROOT, 'tools', 'ci', 'correction.sh')


def git(cwd, *args):
    return subprocess.run(['git', '-c', 'user.name=t', '-c', 'user.email=t@t', '-c',
                           'commit.gpgsign=false'] + list(args), cwd=cwd, check=True,
                          capture_output=True, text=True).stdout.strip()


def sh(cwd, *args, env=None):
    e = dict(os.environ, BASE='main')
    e.update(env or {})
    r = subprocess.run(['bash', SH] + list(args), cwd=cwd, capture_output=True, text=True, env=e)
    return r.returncode, r.stdout + r.stderr


def write(cwd, rel, text):
    p = os.path.join(cwd, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w') as f:
        f.write(text)


@pytest.fixture
def repo(tmp_path):
    d = str(tmp_path)
    git(d, 'init', '-q', '-b', 'main')
    write(d, 'data/db.json', '{}\n')
    write(d, 'corrections/README.md', 'one file per correction\n')
    git(d, 'add', '-A')
    git(d, 'commit', '-qm', 'main')
    git(d, 'checkout', '-qb', 'correction/x')
    write(d, 'corrections/x.json', '{"id": "x"}\n')
    write(d, 'corrections/x.png', 'png\n')
    git(d, 'add', '-A')
    git(d, 'commit', '-qm', 'Correction: x')
    return d


def test_a_pushed_correction_goes(repo):
    code, out = sh(repo, 'pushed')
    assert code == 0 and 'go=true' in out and 'corrections/x.json' in out


def test_a_merge_does_not_go(repo):
    git(repo, 'checkout', '-q', 'main')
    write(repo, 'corrections/README.md', 'edited on main\n')
    git(repo, 'commit', '-qam', 'main moves')
    git(repo, 'checkout', '-q', 'correction/x')
    git(repo, 'merge', '-q', '--no-edit', 'main')
    code, out = sh(repo, 'pushed')
    assert code == 0 and 'go=false' in out and 'parents' in out


def test_a_fix_commit_does_not_go(repo):
    write(repo, 'data/db.json', '{"fixed": 1}\n')
    git(repo, 'commit', '-qam', 'the fix')
    code, out = sh(repo, 'pushed')
    assert code == 0 and 'go=false' in out


def test_list_names_the_files_the_branch_adds(repo):
    code, out = sh(repo, 'list')
    assert code == 0 and 'list=corrections/x.json' in out
    git(repo, 'checkout', '-q', 'main')
    code, out = sh(repo, 'list')
    assert code == 1 and 'no correction file' in out


def test_fix_reads_the_branch_not_the_exit_code(repo):
    code, out = sh(repo, 'fix')
    assert code == 0 and 'fixed=false' in out
    write(repo, 'data/db.json', '{"fixed": 1}\n')
    git(repo, 'commit', '-qam', 'the fix')
    code, out = sh(repo, 'fix')
    assert code == 0 and 'fixed=true' in out and 'data/db.json' in out


def test_untouched_refuses_an_edited_correction(repo):
    sha = git(repo, 'rev-parse', 'HEAD')
    write(repo, 'data/db.json', '{"fixed": 1}\n')
    git(repo, 'commit', '-qam', 'the fix')
    code, out = sh(repo, 'untouched', sha, 'corrections/x.json')
    assert code == 0 and 'as they were pushed' in out
    write(repo, 'corrections/x.png', 'a new snapshot\n')
    git(repo, 'commit', '-qam', 'the snapshot is replaced')
    code, out = sh(repo, 'untouched', sha, 'corrections/x.json')
    assert code == 1 and 'x.json or its snapshot' in out


def test_outputs_go_to_the_step(repo, tmp_path):
    out_file = str(tmp_path / 'out.txt')
    open(out_file, 'w').close()
    code, _out = sh(repo, 'pushed', env={'GITHUB_OUTPUT': out_file})
    assert code == 0
    with open(out_file) as f:
        assert f.read().strip() == 'go=true'


def test_no_such_subcommand(repo):
    code, out = sh(repo, 'nothing')
    assert code == 2 and 'no such subcommand' in out
