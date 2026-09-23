# CLAUDE.md

Start with [AGENTS.md](AGENTS.md) (the repo signpost) and [CONVENTIONS.md](CONVENTIONS.md).

## Git is off limits

Do not run git operations that change state: no commit, add, stash, checkout/switch, branch,
reset, rebase, merge, push, worktree, tag, or PR creation. Git semantics are the owner's to
manage. Read-only inspection (`git status`, `git diff`, `git log`, `git show`) is fine. Leave
changes in the working tree and report what changed.
