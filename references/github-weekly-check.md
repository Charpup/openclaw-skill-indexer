# GitHub Weekly Check Reference

`github-check` inspects each indexed skill path and reports repository sync state.

## Status Rules

- `no-git`: skill path is not in a git worktree.
- `no-origin`: git repo exists but has no `origin` remote / upstream.
- `dirty`: repo has uncommitted local changes (`git status --porcelain`).
- `up-to-date`: local `HEAD` equals upstream.
- `behind`: upstream has commits local `HEAD` does not.
- `ahead`: local `HEAD` has commits not on upstream.
- `diverged`: both local and upstream have unique commits.

## Remote Comparison Flow

1. `git fetch --prune origin`
2. Resolve upstream in order:
   - current branch `@{u}`
   - `refs/remotes/origin/HEAD`
   - fallback `origin/main` then `origin/master`
3. Compare with:
   - `git rev-list --left-right --count HEAD...<upstream>`

## Apply Mode

`--apply` only attempts updates for safe repos:

- clean working tree
- status is `behind`
- update command: `git pull --ff-only origin <branch>`

If `pull --ff-only` fails for any repo, the command exits non-zero.
