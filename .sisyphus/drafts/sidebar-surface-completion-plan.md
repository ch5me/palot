# Draft: Sidebar Surface Completion <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- User wants plan for surfaces that are not fully implemented, stubbed, hidden, or blocked behind incomplete backend/runtime support.
- Priorities called out explicitly:
  - Browser: highest priority.
  - Memory: wants enabled / working.
  - Claude: needs real live connector/backend work.
  - Plugins and Terminal: wants clear path to fully working hybrid control.
  - Pulse: leave unimplemented for now.
- CRM can be hidden for now.
- CH5PM is not yet understood well enough to prioritize; keep as placeholder/deferred.
- Browser for now is intentionally simpler: same-origin, non-agent-controlled, iframe-style browser in web mode and embedded browser in Electron.
- Browser end goal is eventually more advanced, but details can stay deferred for this plan.
- Claude target should mirror prior AIOS behavior: run real Claude Code server-side / in tmux-backed terminal lane, stream it into the surface, and send user input from a text box into the running Claude session.
- Overall goal for surfaces: hybrid control model — human buttons/UI + agent control path, but browser can start without agent control.
- Need plan for implementation + reveal/enable strategy.

## Technical Decisions <!-- oc:id=sec_ac -->
- Treat these UI affordances as "surfaces" / side-panel surfaces.
- Use current registry as source of truth: `apps/desktop/src/renderer/firefly-surface-registry.tsx`.
- Browser target is hybrid:
  - Electron mode: embedded browser surface.
  - Browser mode: iframe fallback.
- Browser can start as same-origin and non-agent-controlled; advanced streamed/programmatic browser control is explicitly deferred.
- Claude target is a real live connector, not compat-only.
- Claude implementation should follow the AIOS model as closely as practical: real Claude Code running in a server-side/tmux/PTY lane, surfaced through Palot terminal-style streaming.
- Memory target is simple repo/project memory-file hierarchy + markdown editor, reusing existing editor/files patterns and Palot-owned memory service.
- Plugins stay inventory-only for now.
- Pulse stays deferred / intentionally unimplemented.
- Plan should separate:
  - real but hidden/off by default
  - real but partial
  - real but Electron-only
  - deferred / intentionally bounded

## Research Findings <!-- oc:id=sec_ad -->
- Registry currently has 16 side-panel surfaces.
- Off by default: browser, pulse, memory, ch5pm.
- Browser is real in Electron but guarded in browser mode; no inline browser in browser-only runtime today.
- Memory is real but off by default; hybrid/local/remote behavior exists already, but user wants simpler memory-files/editor UX on top of Palot-owned memory service.
- Claude is real only as compatibility/import boundary today; no live Claude runtime.
- Palot already has mature PTY/tmux/oracle seams that can host an AIOS-style Claude lane:
  - `apps/desktop/src/main/pty.ts` exposes `spawnTerminal`, `spawnOracle`, `spawnTmux`, `write`, `resize`, `kill`
  - `apps/desktop/src/main/oracles.ts` exposes `createOracle(identity, command?)` and tmux session discovery/control
  - `apps/desktop/src/main/ipc-handlers.ts`, `apps/desktop/src/preload/index.ts`, and `apps/desktop/src/renderer/services/backend.ts` already bridge those seams to renderer code
- AIOS previously used two Claude-related paths:
  - a persistent headless Claude chat process with stream-json protocol
  - a PTY/tmux-backed Claude Code terminal lane with a composer textbox that sends raw input into the running session
- CRM is real but Electron-only and drafts-only for outbound messaging; user wants it hidden for now.
- CH5PM panel exists but uses mock-seeded fallback and is off by default.
- Files, Voice, CRM have explicit deferred sub-features.
- User direction: all important surfaces should eventually support hybrid control — visible UI plus agent control path, except browser which can start simpler.

## Scope Boundaries <!-- oc:id=sec_ae -->
- INCLUDE: plan for browser, memory, claude, plugins, terminal, pulse, files/voice partials, reveal/default-on decisions, CRM hide decision, CH5PM placeholder decision.
- EXCLUDE: implementing the work now.
- EXCLUDE: live product-direction decision on whether CH5PM becomes first-class surface.

## Open Questions <!-- oc:id=sec_af -->
- Claude live connector exact product shape inside Palot: separate dedicated Claude surface, or thin wrapper over oracle/terminal primitives with Claude-focused defaults?
- Terminal target: enough to keep current Electron-only PTY, or should browser mode also gain a terminal transport later?
