# Browser UI Slice Notes <!-- oc:id=sec_aa -->

## Current findings <!-- oc:id=sec_ab -->
- Task 8 completed.
- Current Browser panel is a generic inline webview shell with direct URL entry, nav buttons, history chips, reset, external-open, and simple Electron-only fallback messaging.
- Current browser-only fallback is too blunt: it only says inline webview needs Electron, but the new architecture requires a same-origin published lane or an explicit unavailable state.
- Session shell constraints from `session-side-panel.tsx` matter:
  - Browser content must fully fit a single side-panel tab body
  - vertical tab strip exists when multiple surfaces are available
  - single-surface mode removes the right-side tab strip, so Browser must carry its own header/status clearly
- Locked UI direction:
  - Browser is a product lane, not arbitrary provider URL embedding
  - Electron and browser mode need honest, runtime-specific states
  - MVP controls are minimal: display URL, refresh, open externally, loading/failure states, optional lane selection only if needed
  - shared shell = header + state chip + minimal controls + explicit content-state cards

## Open questions <!-- oc:id=sec_ac -->
- If multi-lane selection is deferred, should the UI mention the active profile/lane at all in v1, or keep that hidden until lane switching exists?
- Should manual URL entry remain as a secondary Electron-only affordance in v1, or should the first release fully pivot to display-URL plus lane actions only?
