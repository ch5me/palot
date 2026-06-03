# Firefly / Supra Conversion Audit <!-- oc:id=sec_aa -->

## Executive summary <!-- oc:id=sec_ab -->

Palot has **not** been fully converted into a Firefly/Supra desktop product.

What is done:
- the **side-panel surface system** is now generalized and documented
- Firefly-style proof surfaces for **review**, **browser**, **notes**, **pulse**, and **memory** exist in the shell
- feature flags, persistence hooks, and command-palette discoverability were added for those surfaces
- the repo now has a documented path for how future Firefly surfaces should land in Palot

What is not done:
- most new surfaces are still **proof shells**, not production Firefly/Supra features
- browser is still a placeholder
- notes, pulse, and memory are mostly local scaffold / mock UI, not wired to real backend contracts
- broader “super app” conversion work outside the side-panel shell has **not** been migrated in a substantive way
- the product is still fundamentally **Palot as an OpenCode desktop app**, not a completed Supra desktop merger

---

## Audit scope

This audit is based on the current Palot repo implementation and docs, especially:
- `README.md`
- `docs/firefly-surface-playbook.md`
- `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- `apps/desktop/src/renderer/atoms/feature-flags.ts`
- `apps/desktop/src/renderer/atoms/ui.ts`
- `apps/desktop/src/renderer/atoms/preferences.ts`
- `apps/desktop/src/renderer/components/agent-detail.tsx`
- `apps/desktop/src/renderer/components/command-palette.tsx`
- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx`
- `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx`
- `apps/desktop/src/renderer/components/side-panel/pulse-panel.tsx`
- `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx`

---

## What has been completed <!-- oc:id=sec_ac -->

### 1. Shared side-panel surface architecture exists <!-- oc:id=sec_ad -->

Done:
- Palot now has a registry-based surface model in `apps/desktop/src/renderer/firefly-surface-registry.tsx`.
- Surfaces are modeled with:
  - id
  - title
  - icon
  - form factor
  - enabled flag
  - availability
  - command IDs
  - persistence key
  - telemetry namespace
  - render/spawn function
- This is the main shell seam for future Firefly/Supra work.

Evidence:
- `apps/desktop/src/renderer/firefly-surface-registry.tsx:35`
- `apps/desktop/src/renderer/firefly-surface-registry.tsx:64`
- `docs/firefly-surface-playbook.md:18`

Assessment:
- **Done** as infrastructure.
- This is the most important real migration artifact so far.

### 2. Side-panel tab type + persistence widened <!-- oc:id=sec_ae -->

Done:
- `SidePanelTabId` now includes `review`, `browser`, `notes`, `pulse`, `memory`.
- Side-panel open state persists.
- Last selected surface persists across sessions.
- Review jump actions route through the new side-panel tab state.

Evidence:
- `apps/desktop/src/renderer/atoms/ui.ts:22`
- `apps/desktop/src/renderer/atoms/ui.ts:25`
- `apps/desktop/src/renderer/atoms/ui.ts:28`
- `apps/desktop/src/renderer/atoms/preferences.ts:19`
- `apps/desktop/src/renderer/atoms/preferences.ts:111`

Assessment:
- **Done**.

### 3. Feature flags added for Firefly surfaces <!-- oc:id=sec_af -->

Done:
- Per-surface feature flags exist for:
  - review
  - browser
  - notes
  - pulse
  - memory
- Defaults are explicit:
  - `review: true`
  - `browserPanelEnabled: true`
  - `notes: true`
  - `pulse: false`
  - `memory: false`
- Toggle atoms exist for all of them.

Evidence:
- `apps/desktop/src/renderer/atoms/feature-flags.ts:26`
- `apps/desktop/src/renderer/atoms/feature-flags.ts:38`
- `apps/desktop/src/renderer/atoms/feature-flags.ts:42`
- `apps/desktop/src/renderer/atoms/feature-flags.ts:50`
- `docs/firefly-surface-playbook.md:31`

Assessment:
- **Done**.
- Good shell discipline; not the same thing as product completion.

### 4. Agent detail now renders side-panel surfaces through the registry <!-- oc:id=sec_ag -->

Done:
- `agent-detail.tsx` now builds side-panel tabs by creating a `FireflySurfaceContext` and calling `getFireflySurfaceTabs(...)`.
- Availability and gating now flow through one path.
- The center layout properly renders the active side-panel surface.

Evidence:
- `apps/desktop/src/renderer/components/agent-detail.tsx:253`
- `apps/desktop/src/renderer/components/agent-detail.tsx:259`
- `apps/desktop/src/renderer/components/agent-detail.tsx:284`
- `apps/desktop/src/renderer/components/agent-detail.tsx:347`

Assessment:
- **Done**.

### 5. Command palette can toggle and discover Firefly surfaces <!-- oc:id=sec_ah -->

Done:
- Command palette Features section can toggle:
  - review
  - browser
  - notes
  - pulse
  - memory
- A `Surfaces` group lists available surfaces for the active session.

Evidence:
- `apps/desktop/src/renderer/components/command-palette.tsx:335`
- `apps/desktop/src/renderer/components/command-palette.tsx:347`
- `apps/desktop/src/renderer/components/command-palette.tsx:358`
- `apps/desktop/src/renderer/components/command-palette.tsx:369`
- `apps/desktop/src/renderer/components/command-palette.tsx:380`
- `apps/desktop/src/renderer/components/command-palette.tsx:391`
- `apps/desktop/src/renderer/components/command-palette.tsx:403`

Assessment:
- **Done** for shell discoverability.

### 6. Surface playbook / operator docs were added <!-- oc:id=sec_ai -->

Done:
- Repo now contains a specific playbook for how Firefly surfaces should be added to Palot.
- README links to that playbook.
- The playbook clearly states that side-panel proof surfaces come first and optional/unstable surfaces stay flag-gated.

Evidence:
- `docs/firefly-surface-playbook.md:1`
- `docs/firefly-surface-playbook.md:12`
- `docs/firefly-surface-playbook.md:24`
- `README.md:267`

Assessment:
- **Done**.

---

## What has been partially moved over

### 1. Review surface

Current state:
- The review panel is real and functional.
- It is the strongest migrated surface because it already existed as substantive product behavior inside Palot.
- In the new registry model it is now treated as a Firefly surface.

Evidence:
- `apps/desktop/src/renderer/firefly-surface-registry.tsx:66`
- `apps/desktop/src/renderer/firefly-surface-registry.tsx:86`
- `README.md:67`

Assessment:
- **Partial-to-done**, but mostly because Palot already had it.
- This is more “reclassified into the new shell” than “moved over from Supra.”

### 2. Browser surface

Current state:
- Browser exists as a tab in the registry and can be toggled.
- It is not an actual embedded browser workflow yet.
- The component explicitly says “Full webview coming soon. This is a placeholder to verify the tab system works.”

Evidence:
- `apps/desktop/src/renderer/firefly-surface-registry.tsx:88`
- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:14`
- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:35`

Assessment:
- **Partial only**.
- Shell placement is moved over; actual product behavior is not.

### 3. Notes surface

Current state:
- Notes exists as a real side-panel tab.
- It has local text entry, summary text, and clear action.
- It does **not** persist through the intended draft system yet.
- It does **not** have autosave, search, CRUD, send-to-AI, or backend integration.
- The playbook says those are the intended behaviors, but the component does not implement them.

Evidence:
- `apps/desktop/src/renderer/firefly-surface-registry.tsx:107`
- `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx:11`
- `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx:12`
- `docs/firefly-surface-playbook.md:51`
- `docs/firefly-surface-playbook.md:54`

Assessment:
- **Partial**.
- The shell and tab exist, but the actual notes feature is still just a local proof component.

### 4. Pulse surface

Current state:
- Pulse exists as a side-panel tab and is default-off.
- It shows static cards like Status, Branch, Project, Freshness.
- It is not connected to real Firefly runtime telemetry, orchestration status, or usage streams.
- It does not meaningfully reuse session metrics yet, despite the playbook guidance.

Evidence:
- `apps/desktop/src/renderer/firefly-surface-registry.tsx:126`
- `apps/desktop/src/renderer/components/side-panel/pulse-panel.tsx:9`
- `apps/desktop/src/renderer/components/side-panel/pulse-panel.tsx:32`
- `docs/firefly-surface-playbook.md:57`

Assessment:
- **Partial**.
- Placement exists; real product conversion does not.

### 5. Memory surface

Current state:
- Memory exists as a side-panel tab and is default-off.
- The component explicitly says no remote memory contract is wired yet.
- It is intentionally a staging surface.

Evidence:
- `apps/desktop/src/renderer/firefly-surface-registry.tsx:145`
- `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx:15`
- `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx:31`
- `docs/firefly-surface-playbook.md:62`

Assessment:
- **Partial**.
- Shell seam exists; actual memory product integration is not done.

---

## What has not been moved over yet <!-- oc:id=sec_aj -->

### 1. Real browser / webview experience <!-- oc:id=sec_ak -->

Not done:
- No real inline browser implementation.
- No navigation model.
- No authenticated browsing workflow.
- No site/session state handling.
- No browser-to-agent workflows beyond placeholder buttons.

Evidence:
- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:20`
- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:35`

Assessment:
- **Not done**.

### 2. Real notes product behavior <!-- oc:id=sec_al -->

Not done:
- no persistence through `use-draft.ts`
- no durable storage
- no search
- no structured CRUD
- no send-to-AI flow
- no backend seam

Evidence:
- `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx:12`
- `docs/firefly-surface-playbook.md:41`
- `docs/firefly-surface-playbook.md:54`

Assessment:
- **Not done** beyond shell proof.

### 3. Real pulse / telemetry / usage experience <!-- oc:id=sec_am -->

Not done:
- no live session metrics integration in the panel itself
- no orchestration graph / queue / scheduler status
- no Firefly runtime signal wiring
- no deeper usage dashboard

Evidence:
- `apps/desktop/src/renderer/components/side-panel/pulse-panel.tsx:32`
- `docs/firefly-surface-playbook.md:57`

Assessment:
- **Not done** beyond shell proof.

### 4. Real memory system integration <!-- oc:id=sec_an -->

Not done:
- no remote memory provider integration
- no recall/search UI
- no graph/list views over actual memory data
- no contract with hosted memory or local memory backends

Evidence:
- `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx:31`
- `docs/firefly-surface-playbook.md:64`

Assessment:
- **Not done** beyond shell proof.

### 5. Broader “super app” conversion <!-- oc:id=sec_ao -->

Not done:
- There is no evidence in the current implementation that Palot has become a full Supra super app beyond these shell seams.
- The main product still reads as Palot/OpenCode desktop: chat, review, automations, migration, OpenCode management.
- No major new top-level product domains were converted into complete Palot-native features.

Evidence:
- `README.md:23`
- `README.md:31`
- `README.md:188`
- `docs/firefly-surface-playbook.md:81`

Assessment:
- **Not done**.
- The repo has gained a migration framework, not a finished conversion.

### 6. Non-side-panel scope from earlier handoff remains deferred <!-- oc:id=sec_ap -->

Still deferred / not materially changed:
- DB work
- voice
- packaging/signing
- auto-update hardening / release readiness
- publishing
- Windows validation
- full external contracts for auth / telemetry / billing / firefly-cloud-related seams

Evidence:
- `README.md:125`
- `README.md:127`
- `README.md:143`
- `README.md:117`
- `docs/firefly-surface-playbook.md:44`

Assessment:
- **Not done**.

---

## Surface-by-surface status table

| Surface | Shell present | Functional | Notes |
|---|---:|---:|---|
| Review | Yes | Mostly yes | Existing Palot feature, now routed through registry |
| Browser | Yes | No | Placeholder only |
| Notes | Yes | No | Local textarea proof, not durable feature |
| Pulse | Yes | No | Static cards, not wired to live telemetry |
| Memory | Yes | No | Explicit staging surface, no backend contract |

---

## What was actually “moved over” <!-- oc:id=sec_aq -->

The honest answer:

What moved over is mostly the **shell architecture** for absorbing Firefly/Supra capabilities into Palot.

That includes:
- registry
- flags
- side-panel placement
- persistence for active tab
- command palette toggles
- basic proof tabs
- docs/playbook for future conversions

What did **not** move over in a complete sense is the underlying product behavior for most of those surfaces.

So if the question is:

### “Did we convert Palot into the Firefly/Supra desktop app?” <!-- oc:id=sec_ar -->
No. Not yet.

### “Did we build the migration seam and land first proof surfaces?” <!-- oc:id=sec_as -->
Yes.

---

## Best current framing

### Done now
- Palot is the implementation base.
- AIOS/Supra-style side-panel surface architecture is in place.
- Review, browser, notes, pulse, and memory are registered in one system.
- Flags and persistence are in place.
- The repo has a documented pattern for future migration.

### Partially done now
- Browser, notes, pulse, and memory have landed as proof tabs.
- They demonstrate shell fit and gating, not full feature parity.

### Not done yet
- Most real supra/super-app behavior.
- Production browser workflows.
- Durable notes feature.
- Real pulse/usage telemetry panel.
- Real memory integration.
- Broader product/domain conversion outside these side-panel seams.

---

## Recommended next work order <!-- oc:id=sec_at -->

1. Turn `notes` from proof tab into a real durable feature. <!-- oc:id=item_aa -->
1. Replace browser placeholder with actual inline browser/webview behavior. <!-- oc:id=item_ab -->
1. Wire `pulse` to live metrics/session/automation/orchestration data. <!-- oc:id=item_ac -->
1. Wire `memory` to a real backend contract. <!-- oc:id=item_ad -->
1. Only after those prove out, evaluate whether any surface deserves promotion beyond side-panel form. <!-- oc:id=item_ae -->

---

## Bottom line

The conversion is **architecturally started but product-incomplete**.

You now have:
- a real migration seam
- real shell integration
- real toggles and persistence
- real proof tabs

You do **not** yet have:
- a completed Firefly/Supra desktop conversion
- full feature migration
- production-grade implementations for most newly added surfaces