# Terminal Session Ownership <!-- oc:id=sec_aa -->

## Decision <!-- oc:id=sec_ab -->

Terminal sessions should be tied to the active worktree when one exists, otherwise to the project directory, while still remaining launched from the current agent session surface.

## Rule <!-- oc:id=sec_ac -->

Resolution order:
1. `agent.worktreePath` <!-- oc:id=item_aa -->
1. `agent.directory` <!-- oc:id=item_ab -->
1. `agent.projectDirectory` only as fallback metadata for apply-to-project or parent-project actions <!-- oc:id=item_ac -->

## Why <!-- oc:id=sec_ad -->

- The user's operational shell should match the checkout they are currently viewing.
- Worktree sessions are the most likely place where a terminal must reflect branch-specific state.
- Agent-session identity still matters for `opencode attach`, but the shell cwd should be the active checkout, not an abstract session id.
- Project-level binding would be wrong for worktree-first review/edit flows because commands would run in the parent checkout instead of the isolated branch.

## PTY implication <!-- oc:id=sec_ae -->

When PTY runtime lands, create terminal processes per visible terminal surface with cwd bound to:
- `worktreePath` when present
- otherwise `directory`

`sessionId` remains the attach/coordination key, not the cwd owner.