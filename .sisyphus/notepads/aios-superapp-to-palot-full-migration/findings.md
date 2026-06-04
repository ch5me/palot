# AIOS -> Palot migration — findings

## Plan
- New plan: .sisyphus/plans/aios-superapp-to-palot-full-migration.md (22 tasks + F1-F4).
- Supersedes firefly-superapp-port-remaining-real-implementation-work.md (RETIRED) and the
  aspirational matrix (firefly-superapp-port-matrix-and-backlog.md, "Ported shell" rows false).

## Source of truth
- Source app: /Users/hassoncs/Workspaces/aios-superapp (Tauri v2 Rust + React/Vite).
- 116-command Tauri backend; surfaces in src/components/*Pane.tsx, logic in src/lib/*.ts.

## Real palot state (verified)
- Exist: chat, automations, review, browser, notes, pulse, memory.
- Missing (to build): terminal, files, editor, oracle, voice, bridges, crm, studio, plugins, claude-compat.

## T1 DONE
- boulder.json -> new plan; old plan annotated RETIRED.

## T2 BLOCKED (env)
- Worktree cannot `bun install`: palot/package.json uses relative workspace links
  `../ch5-packages/...` which resolve next to the repo, not next to the worktree.
- From worktree, ../ch5-packages is missing -> install fails -> no boot.
- Needs decision: run migration in MAIN repo, or add sibling ch5-packages symlink for worktree.

## Hard blocker for execution
- All runtime/surface tasks (W2-W5) need a booting app. T2 gates them. Cannot proceed
  with real verification until the worktree/install issue is resolved by Chris.
