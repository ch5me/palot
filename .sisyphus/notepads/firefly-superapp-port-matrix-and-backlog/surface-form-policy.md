# Surface Form Policy <!-- oc:id=sec_aa -->

## Decision <!-- oc:id=sec_ab -->

Elf should use three surface forms, but only one is a default starting point:

- `side-panel-tab`: default for proof surfaces and lightweight operator workflows.
- `main-pane`: reserved for workflows that need persistent primary workspace real estate inside an existing session view.
- `route-level`: reserved for product areas that are larger than one session and need their own navigation identity.

## Rules <!-- oc:id=sec_ac -->

### Side-panel first <!-- oc:id=sec_ad -->

Use a side-panel tab first when the surface:
- complements the active chat/session
- needs quick peek/edit behavior
- can tolerate narrower width
- has uncertain product shape
- is optional or flag-gated

This matches the current Firefly playbook and existing registry path.

### Main-pane only when session-centric and durable <!-- oc:id=sec_ae -->

Promote a surface to `main-pane` only when it remains centered on one active session but no longer fits a narrow side panel.

Examples likely to earn `main-pane` later:
- Files + file viewer workflow tied to one session or project
- Editor workspace tied to the active session/project
- Terminal workspace if it becomes a first-class daily-driver pane beside chat

`main-pane` should still reuse the current session shell, not bypass it.

### Route-level only when the surface outgrows one session <!-- oc:id=sec_af -->

Use a dedicated route only when the surface:
- spans multiple sessions or projects
- needs shareable/deep-linkable navigation identity
- wants its own app-bar/sidebar composition
- is clearly bigger than a side utility panel

Likely route-level candidates later:
- Studio / Office preview workspace
- Connectors / Bridges hub if it becomes cross-project
- Claude Code compatibility/import workspace if it becomes onboarding or migration heavy

## Immediate implication for backlog <!-- oc:id=sec_ag -->

For the current port backlog:
- Notes, Pulse, Memory, Browser stay `side-panel-tab`
- Files should start as `side-panel-tab` or review-adjacent shell, then graduate only if daily-driver usage proves it
- Terminal and Editor should start as `main-pane` design targets, but can land as thinner proof shells first if needed
- Studio should be treated as the strongest route-level candidate
- Bridges and Claude Code need IA decisions before route promotion

## Why <!-- oc:id=sec_ah -->

Current evidence in Elf:
- the mature shell path is the side-panel registry in `firefly-surface-registry.tsx`, `agent-detail.tsx`, and `session-side-panel.tsx`
- `@ch5me/workspace` already gives the session view a resizable main-content + side-panel seam
- `SplitPane` and `ResizablePanes` cover current shell needs without importing a more complex grid model yet

This means Elf does not need generalized multi-pane routing first. It needs disciplined promotion rules so new surfaces do not outrun the proven shell.