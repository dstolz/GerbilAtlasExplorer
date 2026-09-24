#!/usr/bin/env bash
# The shell of .github/workflows/apply-correction.yml and rebase-corrections.yml, kept here
# so it can be run at a prompt and tested under tests/python/test_ci_scripts.py rather than
# discovered on a runner forty minutes in. Every subcommand reads git and prints what it
# found; a `key=value` line goes to $GITHUB_OUTPUT as well when that is set.
#
#   correction.sh pushed                 did the commit at HEAD add corrections/*.json, on one parent?
#   correction.sh list                   the correction files this branch adds to $BASE (space-separated)
#   correction.sh fix                    the files outside corrections/ this branch changes against $BASE
#   correction.sh verdict                what the session left: a fix, a reasoned no-fix, or nothing
#   correction.sh untouched SHA FILE...  each correction FILE (and its snapshot) is the same at SHA and HEAD
#   correction.sh tests                  the branch takes no test and no assertion out of tests/, and skips none
#   correction.sh credential BIN        ask the model one word through BIN; exit 1 if it cannot be reached
#   correction.sh open-pr BRANCH         open the pull request from build/pr.md (or --fill-first), print its number
#   correction.sh wait-ci NUMBER         wait on the checks of pull request NUMBER; exit 1 if any fails
#
# BASE defaults to origin/main. Nothing here needs more than git; credential wants jq and
# the Claude Code binary, and open-pr/wait-ci gh.
set -euo pipefail

BASE=${BASE:-origin/main}

out() {                                  # out key value -- to the log, and to the step's outputs
  printf '%s=%s\n' "$1" "$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"; fi
}

cmd=${1:?usage: correction.sh pushed|list|fix|verdict|untouched|tests|open-pr|wait-ci ...}
shift

case "$cmd" in
  pushed)
    # A push carrying a merge commit is not a correction: the merge brings in whatever
    # main has under corrections/, and a branch that already carries its fix would be
    # applied a second time. So the parent count and an A-filter against the one parent.
    n=$(git rev-list --parents -n 1 HEAD | wc -w)
    if [ "$n" -ne 2 ]; then
      echo "HEAD has $((n - 1)) parents: a merge or a root, not a pushed correction"
      out go false
      exit 0
    fi
    added=$(git diff --name-only --diff-filter=A HEAD^ HEAD -- 'corrections/*.json' || true)
    if [ -z "$added" ]; then
      echo "HEAD adds no corrections/*.json"
      out go false
    else
      echo "$added"
      out go true
    fi
    ;;
  list)
    list=$(git diff --name-only --diff-filter=A "$BASE...HEAD" -- 'corrections/*.json' | tr '\n' ' ' | sed 's/ $//')
    out list "$list"
    # The common way to land here is a dispatch left on the default branch, where the
    # ref dropdown starts: main adds nothing to itself, so the list is empty. Say that,
    # rather than leave a correct answer to a question nobody meant to ask.
    if [ -z "$list" ]; then
      echo "::error::no correction file on this branch against $BASE -- $(git rev-parse --abbrev-ref HEAD) adds none. Dispatch this on the correction/<id> branch that carries it, or name the file in the \`correction\` input to take one that is already on $BASE"
      exit 1
    fi
    ;;
  fix)
    fix=$(git diff --name-only "$BASE...HEAD" | grep -v '^corrections/' || true)
    if [ -n "$fix" ]; then
      printf 'the branch changes, outside corrections/:\n%s\n' "$fix"
      out fixed true
    else
      echo "the branch carries nothing outside corrections/"
      out fixed false
    fi
    ;;
  verdict)
    # What a session left behind, in the three ways it can end. `read-and-closed` is the one
    # stop the prompt allows -- a plate that supports none of the four causes -- and it is an
    # outcome rather than a failure: the session read the plate, said what it found in
    # build/no-fix.md, and left the inputs alone, which is the right answer to a correction
    # that asks for nothing. Only the file makes it that: a session that stops without
    # writing one has stopped without a reason, and reads as `nothing`.
    fix=$(git diff --name-only "$BASE...HEAD" | grep -v '^corrections/' || true)
    nofix=${NOFIX:-build/no-fix.md}
    if [ -n "$fix" ]; then
      printf 'the branch changes, outside corrections/:\n%s\n' "$fix"
      out verdict fixed
    elif [ -s "$nofix" ]; then
      echo "the session left $nofix: it read the plate and found none of the four causes"
      out verdict read-and-closed
    else
      echo "the branch carries nothing outside corrections/, and there is no $nofix"
      out verdict nothing
    fi
    ;;
  untouched)
    sha=${1:?untouched SHA FILE...}
    shift
    for f in "$@"; do
      if ! git diff --quiet "$sha" HEAD -- "${f%.json}.*"; then
        echo "::error::$f or its snapshot changed between $sha and HEAD, and both are the reader's own record"
        exit 1
      fi
    done
    echo "the correction files are as they were pushed"
    ;;
  tests)
    # What a correction may change under tests/ is a literal its rebuild moved -- a count, a
    # list of superseded rows, the note that says what moved them. The three ways a suite
    # goes green without the data agreeing with it are refused: a test taken out, an
    # assertion taken out, a skip put in. Counted from where the branch left $BASE, so what
    # main changed in the meantime is not read as the branch's.
    base=$(git merge-base "$BASE" HEAD)
    count() { { git grep -h -E "$1" "$2" -- tests/ || true; } | wc -l; }
    defs='^[[:space:]]*(def test_|test\()'
    asserts='^[[:space:]]*(assert[[:space:](]|(await )?expect(\.[a-z]+)?\()'
    skips='pytest\.(skip|xfail|importorskip)|mark\.(skip|skipif|xfail)|(test|describe)\.(skip|fixme|only)'
    t0=$(count "$defs" "$base"); t1=$(count "$defs" HEAD)
    a0=$(count "$asserts" "$base"); a1=$(count "$asserts" HEAD)
    added=$(git diff "$base" HEAD -- tests/ | grep -v '^+++' | grep '^+' | grep -E "$skips" || true)
    bad=0
    if [ "$t1" -lt "$t0" ]; then
      echo "::error::the branch takes $((t0 - t1)) test(s) out of tests/ ($t0 -> $t1)"; bad=1
    fi
    if [ "$a1" -lt "$a0" ]; then
      echo "::error::the branch takes $((a0 - a1)) assertion(s) out of tests/ ($a0 -> $a1)"; bad=1
    fi
    if [ -n "$added" ]; then
      printf '::error::the branch skips a test:\n%s\n' "$added"; bad=1
    fi
    [ "$bad" -eq 0 ] || exit 1
    echo "tests/: $t1 tests and $a1 assertions, none taken out and none skipped"
    ;;
  credential)
    # One word through the binary the session will use, with the token the workflow holds.
    # A session that cannot reach the model ends the same way in under a second, inside an
    # action that hides its output -- so what the CLI says is read here instead, left in
    # build/credential.txt for the job summary and printed.
    bin=${1:?credential BIN}
    mkdir -p build
    set +e
    "$bin" -p 'Reply with one word: ready' --model "${MODEL:-claude-opus-5}" --max-turns 1 \
      --output-format json > build/credential.json 2> build/credential.err
    code=$?
    set -e
    said=$(jq -r '.result // empty' build/credential.json 2>/dev/null || true)
    [ -n "$said" ] || said=$(tail -n 20 build/credential.err 2>/dev/null || true)
    printf '%s\n' "${said:-(the CLI said nothing)}" > build/credential.txt
    cat build/credential.txt
    # a run that wrote no readable result is not a run that reached the model, and an
    # is_error the CLI set is one whatever else it wrote (`.is_error // true` would not do:
    # in jq, `false // true` is true, and every good run would read as a bad one)
    ok=$(jq -r 'if .is_error == false then "yes" else "no" end' build/credential.json 2>/dev/null || echo no)
    if [ "$code" -ne 0 ] || [ "$ok" != yes ]; then
      echo "::error::the model could not be reached with this token (claude -p exited $code)"
      out credential bad
      exit 1
    fi
    out credential good
    ;;
  open-pr)
    branch=${1:?open-pr BRANCH}
    pr=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
    if [ -z "$pr" ]; then
      sha=$(git rev-parse HEAD)
      if [ -s build/pr.md ]; then
        # first line the title, the rest the body; {{SHA}} is the commit the picture is pinned to
        title=$(head -n 1 build/pr.md | sed 's/^# *//')
        tail -n +2 build/pr.md | sed "s/{{SHA}}/$sha/g" > build/pr_body.md
        gh pr create --base "${BASE#origin/}" --head "$branch" --title "$title" --body-file build/pr_body.md || made=no
      else
        gh pr create --base "${BASE#origin/}" --head "$branch" --fill-first || made=no
      fi
      pr=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
      if [ "${made:-}" = no ] && [ -z "$pr" ]; then
        # the workflow's own token may not: Settings -> Actions -> General -> Workflow
        # permissions -> "Allow GitHub Actions to create and approve pull requests"
        echo "::error::the pull request for $branch could not be opened with this token; the fix is on the branch. Open it by hand from build/pr.md, or allow GitHub Actions to create pull requests under Settings -> Actions -> General"
      fi
    fi
    [ -n "$pr" ] || { echo "::error::no pull request for $branch"; exit 1; }
    out pr "$pr"
    out url "$(gh pr view "$pr" --json url --jq .url)"
    ;;
  wait-ci)
    pr=${1:?wait-ci NUMBER}
    sleep "${CI_SETTLE_SECONDS:-90}"           # let ci.yml register on the head
    # --watch holds until every check has finished; --fail-fast lets go at the first red one.
    if gh pr checks "$pr" --watch --fail-fast; then
      out ci green
    else
      out ci red
      exit 1
    fi
    ;;
  *)
    echo "correction.sh: no such subcommand: $cmd" >&2
    exit 2
    ;;
esac
