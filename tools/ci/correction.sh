#!/usr/bin/env bash
# The shell of .github/workflows/apply-correction.yml and rebase-corrections.yml, kept here
# so it can be run at a prompt and tested under tests/python/test_ci_scripts.py rather than
# discovered on a runner forty minutes in. Every subcommand reads git and prints what it
# found; a `key=value` line goes to $GITHUB_OUTPUT as well when that is set.
#
#   correction.sh pushed                 did the commit at HEAD add corrections/*.json, on one parent?
#   correction.sh list                   the correction files this branch adds to $BASE (space-separated)
#   correction.sh fix                    the files outside corrections/ this branch changes against $BASE
#   correction.sh untouched SHA FILE...  each correction FILE (and its snapshot) is the same at SHA and HEAD
#   correction.sh open-pr BRANCH         open the pull request from build/pr.md (or --fill-first), print its number
#   correction.sh wait-ci NUMBER         wait on the checks of pull request NUMBER; exit 1 if any fails
#
# BASE defaults to origin/main. Nothing here needs more than git, and open-pr/wait-ci gh.
set -euo pipefail

BASE=${BASE:-origin/main}

out() {                                  # out key value -- to the log, and to the step's outputs
  printf '%s=%s\n' "$1" "$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then printf '%s=%s\n' "$1" "$2" >> "$GITHUB_OUTPUT"; fi
}

cmd=${1:?usage: correction.sh pushed|list|fix|untouched|open-pr|wait-ci ...}
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
    [ -n "$list" ] || { echo "::error::no correction file on this branch against $BASE"; exit 1; }
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
  open-pr)
    branch=${1:?open-pr BRANCH}
    pr=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
    if [ -z "$pr" ]; then
      sha=$(git rev-parse HEAD)
      if [ -s build/pr.md ]; then
        # first line the title, the rest the body; {{SHA}} is the commit the picture is pinned to
        title=$(head -n 1 build/pr.md | sed 's/^# *//')
        tail -n +2 build/pr.md | sed "s/{{SHA}}/$sha/g" > build/pr_body.md
        gh pr create --base "${BASE#origin/}" --head "$branch" --title "$title" --body-file build/pr_body.md
      else
        gh pr create --base "${BASE#origin/}" --head "$branch" --fill-first
      fi
      pr=$(gh pr list --head "$branch" --state open --json number --jq '.[0].number')
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
