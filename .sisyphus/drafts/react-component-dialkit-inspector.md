# Draft: React Component Dialkit Inspector <!-- oc:id=sec_aa -->

## Requirements (confirmed) <!-- oc:id=sec_ab -->
- Goal: plan new reusable React library for development mode that wraps React app, provides debug toolbar, inspect mode, hover/select, and Dialkit-style live prop override popup.
- Scope includes architecture for silent wrapping strategy, app-level context/provider, inspect/selection UX, live prop editing, and reusable package boundaries.
- Must be inspired by `joshpuckett/dialkit` and existing local debug tooling in `/Users/hassoncs/src/ch5/react-voice-inspector`.
- Must identify common pieces that can stay DRY and modular across future debug libraries.
- Potential home/reuse target also involves `~/src/ch5/ch5-devtools`, but repo policy there says keep React/web packages out of that repo.
- New requirement: holistic system — inspect mode, prop editing, and direct text/live-edit mode integrated together.
- New requirement: save prop changes to localStorage.
- Future direction to capture in plan: save approved changes back to live source code.
- Dialkit can be used, forked, or vendored if needed.
- Hotkey pick: `Cmd/Ctrl+Shift+I`.
- Prop discovery pick: hybrid (auto-infer + explicit override list).

## Technical Decisions <!-- oc:id=sec_ac -->
- Planning only. No implementation.
- Early hypothesis: shared React/web devtools primitives likely belong in `/Users/hassoncs/src/ch5/ch5-packages`, not `ch5-devtools`, because `ch5-devtools` is CLI/runtime only.
- Existing browser-extension inspector patterns from `react-voice-inspector` are relevant for DOM/fiber inspection, overlay, skip rules, and top-frame/iframe separation.

## Research Findings <!-- oc:id=sec_ad -->
- `react-voice-inspector/docs/VISION.md`: argues for visual-to-code identification, hover highlight, click select, portable tooling.
- `react-voice-inspector/docs/ARCHITECTURE.md`: contains reusable patterns for React fiber access, props sanitization, overlay lifecycle, iframe handling, skip patterns, source mapping, and performance constraints.
- `palot/apps/desktop/src/renderer/atoms/react-scan.ts`: shows existing dev-only toggle pattern via persisted flag + reload-before-React-init.
- `ch5-devtools/README.md`: explicit boundary says pure CLI/agent-runtime only; React packages should stay elsewhere.

## Open Questions <!-- oc:id=sec_ae -->
- Should first version target React dev builds only, or also support production-ish internal debug builds with instrumentation?
- How much “silent wrapping” is acceptable: app root provider only, or Babel/Vite transform for per-component registration?
- Should prop editing be ephemeral runtime-only, or optionally persist as sharable recipes/scenarios?
- How should unsupported prop types behave: functions, refs, children, complex objects, hooks-derived values?
- Should initial target package live in this repo family as generic package, or in dedicated repo first then extract shared core later?

## Scope Boundaries <!-- oc:id=sec_af -->
- INCLUDE: architecture, package boundaries, phased build plan, shared-kernel extraction plan, integration story for host apps, risk analysis.
- EXCLUDE: implementation, code changes, packaging execution.