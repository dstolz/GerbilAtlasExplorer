"""tools/ci/correction.sh: the shell of apply-correction.yml, run against a repository
this makes rather than discovered on a runner forty minutes in.

Each test builds a small git repository with a `main` and a `correction/x` branch, plays
the situation the workflow has to tell apart -- a pushed correction, a merge commit that
brings corrections/ in, a branch that already carries its fix, a session that edited the
correction it was applying -- and reads what the script prints.
"""
import os
import shlex
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
    # the branch it was run on, and the two ways out, so a dispatch left on the default
    # branch reads as the mistake it is
    assert code == 1 and 'no correction file' in out
    assert 'main adds none' in out and 'correction` input' in out


def test_fix_reads_the_branch_not_the_exit_code(repo):
    code, out = sh(repo, 'fix')
    assert code == 0 and 'fixed=false' in out
    write(repo, 'data/db.json', '{"fixed": 1}\n')
    git(repo, 'commit', '-qam', 'the fix')
    code, out = sh(repo, 'fix')
    assert code == 0 and 'fixed=true' in out and 'data/db.json' in out


def test_verdict_reads_a_fix_on_the_branch(repo):
    write(repo, 'data/db.json', '{"fixed": 1}\n')
    git(repo, 'commit', '-qam', 'the fix')
    code, out = sh(repo, 'verdict')
    assert code == 0 and 'verdict=fixed' in out and 'data/db.json' in out


def test_verdict_reads_a_plate_that_asks_for_nothing(repo):
    # the one stop the prompt allows, and the file is the whole of what makes it one
    write(repo, 'build/no-fix.md', 'GrO on plate 1 is where it already is\n\n1.5670 vs 1.5662 mm2\n')
    code, out = sh(repo, 'verdict')
    assert code == 0 and 'verdict=read-and-closed' in out


def test_verdict_refuses_an_empty_no_fix_file(repo):
    write(repo, 'build/no-fix.md', '')
    code, out = sh(repo, 'verdict')
    assert code == 0 and 'verdict=nothing' in out


def test_verdict_reads_a_session_that_left_neither(repo):
    code, out = sh(repo, 'verdict')
    assert code == 0 and 'verdict=nothing' in out


def test_verdict_does_not_take_an_edited_correction_for_a_fix(repo):
    # a session that only touched corrections/ has pushed no fix, whatever else it did;
    # `untouched` is what refuses it, and the verdict must not call it one
    write(repo, 'corrections/x.json', '{"id": "x", "edited": true}\n')
    git(repo, 'commit', '-qam', 'the session edited the correction')
    code, out = sh(repo, 'verdict')
    assert code == 0 and 'verdict=nothing' in out


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


SUITE = '''def test_tips():
    """195 in their own."""
    assert (195, 35, 10) == (195, 35, 10)


def test_filters():
    assert 45 == 45
'''


@pytest.fixture
def suite(repo):
    """The branch as `corrections.py rebase` leaves it: main, with a test file, merged in."""
    git(repo, 'checkout', '-q', 'main')
    write(repo, 'tests/python/test_x.py', SUITE)
    git(repo, 'add', '-A')
    git(repo, 'commit', '-qm', 'main has a suite')
    git(repo, 'checkout', '-q', 'correction/x')
    git(repo, 'merge', '-q', '--no-edit', 'main')
    return repo


def test_tests_passes_a_moved_literal(suite):
    write(suite, 'tests/python/test_x.py', SUITE.replace('195', '193').replace('35', '37')
          .replace('45 == 45', '47 == 47'))
    git(suite, 'commit', '-qam', 'two literals move with the rebuild')
    code, out = sh(suite, 'tests')
    assert code == 0 and '2 tests and 2 assertions' in out


def test_tests_refuses_a_test_taken_out(suite):
    write(suite, 'tests/python/test_x.py', SUITE.split('\n\n\ndef test_filters')[0] + '\n')
    git(suite, 'commit', '-qam', 'a failing test goes')
    code, out = sh(suite, 'tests')
    assert code == 1 and '1 test(s) out' in out


def test_tests_refuses_an_assertion_taken_out(suite):
    write(suite, 'tests/python/test_x.py', SUITE.replace('    assert 45 == 45', '    pass'))
    git(suite, 'commit', '-qam', 'a failing assertion goes')
    code, out = sh(suite, 'tests')
    assert code == 1 and '1 assertion(s) out' in out


def test_tests_refuses_a_skip(suite):
    write(suite, 'tests/python/test_x.py',
          SUITE.replace('def test_filters', '@pytest.mark.skip\ndef test_filters'))
    git(suite, 'commit', '-qam', 'a failing test is skipped')
    code, out = sh(suite, 'tests')
    assert code == 1 and 'skips a test' in out and 'mark.skip' in out


def test_tests_does_not_read_mains_changes_as_the_branchs(suite):
    # main may retire a test while the correction waits; the rebase brings that in, and it
    # is main's change, not the session's
    git(suite, 'checkout', '-q', 'main')
    write(suite, 'tests/python/test_x.py', SUITE.split('\n\n\ndef test_filters')[0] + '\n')
    git(suite, 'commit', '-qam', 'main retires a test')
    git(suite, 'checkout', '-q', 'correction/x')
    git(suite, 'merge', '-q', '--no-edit', 'main')
    code, out = sh(suite, 'tests')
    assert code == 0 and '1 tests and 1 assertions' in out


def stub_cli(cwd, name, out='', err='', code=0):
    """A `claude` that prints what the real one would and exits as it would."""
    p = os.path.join(cwd, name)
    write(cwd, name + '.out', out)
    write(cwd, name + '.err', err)
    with open(p, 'w') as f:
        f.write('#!/usr/bin/env bash\n')
        f.write('cat %s\n' % shlex.quote(p + '.out'))
        f.write('cat %s >&2\n' % shlex.quote(p + '.err'))
        f.write('exit %d\n' % code)
    os.chmod(p, 0o755)
    return p


def test_credential_reads_the_word_the_model_sent_back(repo):
    bin = stub_cli(repo, 'claude-ok', out='{"is_error": false, "result": "ready"}')
    code, out = sh(repo, 'credential', bin)
    assert code == 0 and 'credential=good' in out and 'ready' in out


def test_credential_fails_on_a_token_the_model_refuses(repo):
    # what the CLI leaves when the token has lapsed: a result that is an error, exit 1
    bin = stub_cli(repo, 'claude-401',
                   out='{"is_error": true, "result": "Invalid API key - Please run /login"}',
                   code=1)
    code, out = sh(repo, 'credential', bin)
    assert code == 1 and 'credential=bad' in out
    assert 'Invalid API key' in out                      # the CLI's own words, not ours
    with open(os.path.join(repo, 'build', 'credential.txt')) as f:
        assert 'Invalid API key' in f.read()             # and the job summary reads them here


def test_credential_fails_when_the_cli_writes_no_result(repo):
    bin = stub_cli(repo, 'claude-crash', err='claude: error while loading shared libraries', code=127)
    code, out = sh(repo, 'credential', bin)
    assert code == 1 and 'credential=bad' in out and 'shared libraries' in out


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
