# Firefly Surface Playbook <!-- oc:id=sec_aa -->

## Purpose <!-- oc:id=sec_ab -->
Use this when adding a Firefly surface to Elf

Firefly surface work must:
- preserve Elf as the execution base
- keep OpenCode as the flagship workflow
- use one registry/flag/persistence path instead of one-off wiring
- avoid renderer-side Node/Electron coupling

## Shell rules <!-- oc:id=sec_ac -->
- Side-panel proof surfaces belong in the existing side-panel tab system first.
- Full-route surfaces should only be added when the surface is clearly larger than a side panel and the data model is already proven.
- Optional or unstable surfaces must be flag-gated.
- Disabled surfaces must not break startup, restore, or focus handling.

## Registry path <!-- oc:id=sec_ad -->
Current registry substrate:
- `apps/desktop/src/renderer/components/side-panel/side-panel-tabs.tsx`
- `apps/desktop/src/renderer/components/side-panel/session-side-panel.tsx`
- `apps/desktop/src/renderer/components/agent-detail.tsx`

When adding a side-panel Firefly surface:
1. Widen `SidePanelTabId` in `apps/desktop/src/renderer/atoms/ui.ts` <!-- oc:id=item_aa -->
1. Add or extend a flag in `apps/desktop/src/renderer/atoms/feature-flags.ts` <!-- oc:id=item_ab -->
1. Create the panel component under `apps/desktop/src/renderer/components/side-panel/` <!-- oc:id=item_ac -->
1. Register the surface in `apps/desktop/src/renderer/components/agent-detail.tsx` <!-- oc:id=item_ad -->
1. Add discoverability/toggle entry in `apps/desktop/src/renderer/components/command-palette.tsx` <!-- oc:id=item_ae -->

## Flag policy <!-- oc:id=sec_ae -->
- Use `atomWithStorage<boolean>("elf:<feature>Enabled", <default>)`
- Add a write-only toggle atom next to the storage atom
- Default ON only for low-risk proof surfaces
- Default OFF for expensive, native-heavy, or uncertain surfaces
- Cmd+K Features group is the default toggle home

## Persistence expectations <!-- oc:id=sec_af -->
- Session-level UI state belongs in `apps/desktop/src/renderer/atoms/ui.ts`
- Cross-session user preferences belong in `apps/desktop/src/renderer/atoms/preferences.ts`
- Draft-like text persistence should reuse `apps/desktop/src/renderer/hooks/use-draft.ts`
- If a disabled surface was previously active, restore logic must fall back safely to a valid surface

## Backend seam rules <!-- oc:id=sec_ag -->
- Renderer must import from `apps/desktop/src/renderer/services/backend.ts`
- Do not import Node.js modules in renderer components or hooks
- If a new surface needs native capabilities, add preload/main seams and expose them through `services/backend.ts`
- Browser-mode parity should be considered whenever the backend service layer changes

## Proof-surface guidance <!-- oc:id=sec_ah -->
### Notes <!-- oc:id=sec_ai -->
- Best first proof surface
- Start as a side-panel tab
- Preserve autosave, search, simple CRUD, and send-to-AI behavior
- Current Elf proof: flag-gated tab, default ON

### Pulse / usage <!-- oc:id=sec_aj -->
- Reuse `session-metrics-bar.tsx` and `lib/session-metrics.ts`
- Start with empty and populated states before broad dashboard ambitions
- Current Elf proof: flag-gated tab, default OFF

### Memory <!-- oc:id=sec_ak -->
- Start default OFF
- Prefer a simple fallback/list view before a graph-heavy implementation
- Current Elf proof: flag-gated tab, default OFF

## QA minimums <!-- oc:id=sec_al -->
Every new Firefly surface should be verified for:
1. appears in the right registry path <!-- oc:id=item_af -->
1. opens from the intended shell entrypoint <!-- oc:id=item_ag -->
1. renders without shell regressions <!-- oc:id=item_ah -->
1. survives a relaunch or explicit restore path if persistence applies <!-- oc:id=item_ai -->
1. behaves safely when its feature flag is turned off <!-- oc:id=item_aj -->

## Verification lane <!-- oc:id=sec_am -->
Minimum commands before claiming the work is ready:
- `bun run lint`
- `bun run check-types`
- `cd apps/desktop && bun run dev` for manual proof

## Non-goals <!-- oc:id=sec_an -->
- Do not add new product work to `aios-superapp`
- Do not create second first-class chat workflows beside OpenCode
- Do not let optional surfaces outrank terminal/browser/files/auth/telemetry/billing work