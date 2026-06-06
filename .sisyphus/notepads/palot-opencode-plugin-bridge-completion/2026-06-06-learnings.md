# Learnings

- `OPENCODE_PLUGIN` only injects plugin file path for managed Palot-spawned servers; attached existing servers cannot be retrofitted by env mutation.
- Current `palot-bridge.js` default export instantiates `createPalotPlugin()` with no callback injection; callback seam is scaffold/test-friendly, not live host hydration.
- Official OpenCode plugin docs center on plugin context + tool/hook APIs, not host callback hydration into arbitrary local factory args.
- Best completion path: make managed-vs-attached policy explicit, harden contracts with shared schemas, and finish real browser action implementations.

- Browser lane runtime already has CDP websocket transport; click/type/scroll can be completed without new sidecars by sending `Input.dispatchMouseEvent`, `Input.insertText`, and enter-key events through existing CDP socket path.
- Canonical bridge doc needed line drift cleanup after implementation; old references to placeholders and no-Zod state were still present even after code landed.
- Managed proof lane can block on devmux startup in worktree; non-interactive `svc:attach` is not enough because devmux attach expects a TTY. Need tmux-aware log capture or direct log file path for future replay.
- Final audit needed explicit evidence files for F1/F2/F3/F4 because plan-level boxes alone were too coarse to explain managed-proof blocker versus completed code/doc work.
