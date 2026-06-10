# Multiplayer Agent Browser <!-- oc:id=sec_aa -->

## TL;DR <!-- oc:id=sec_ab -->

Build the Firefly browser side panel into a shared browser surface with two modes:

1. **Local mode** — simple iframe mode for arbitrary URLs, accepting normal iframe limitations. <!-- oc:id=item_aa -->
1. **Remote mode** — a hosted Chrome session streamed into the panel, with CDP as the control plane and a socket-fed presence layer for humans and agents. <!-- oc:id=item_ab -->

The architecture should reuse existing seams instead of inventing a new browser product:
- `palot` owns the panel, lane selection, session binding, and plugin/runtime projection.
- `magic-browser` remains the browser-generic control/runtime layer and session authority for agent actions.
- `ghost-browser` is prior art for screencast, viewer input, and lease semantics; do not make it a hard runtime dependency for P1.
- `ch5-packages` provides motion/cursor primitives for ghost-cursor rendering.
- Loom is the likely long-term projection surface for presence/state, but **not** the critical path for the first streamed-browser milestone.

The recommended path is:
- **P0**: keep/finish local iframe mode as the baseline side-panel surface.
- **P1**: remote shared browser with single visible stream + single control lease holder.
- **P2**: multi-cursor presence for humans and agents.
- **P3**: multi-human shared session semantics across independent Firefly clients.

## Why this plan exists <!-- oc:id=sec_ac -->

Chris wants a **multiplayer live browser surface** inside the Firefly client, not just another automation integration. The key novelty is not merely remote browser control; it is a shared browser session that can be watched and acted on by multiple humans and multiple agents at once, with visible labeled cursors and a coherent control model.

That means the plan has to answer four questions together:
- where the browser lives,
- how pixels get to the panel,
- how clicks/types/scrolls get back to the browser,
- how multiple humans and agents coexist without control chaos.

## Current repo reality <!-- oc:id=sec_ad -->

### Palot / Firefly client <!-- oc:id=sec_ae -->

Existing browser-panel work is already much closer to the target than a blank slate:

- Browser surface registry already includes a Browser tab in `apps/desktop/src/renderer/firefly-surface-registry.tsx:118`.
- The current browser panel already renders a streamed/same-origin iframe shell, not just an arbitrary site iframe, in `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:98` and `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx:671`.
- `palot` already has a browser-lane CDP helper in `apps/desktop/src/main/browser-lane-cdp.ts:97` with `Page.navigate`, `Input.dispatchMouseEvent`, `Input.insertText`, and `Input.dispatchKeyEvent` dispatch.
- `palot` already has a browser action overlay state store in `apps/desktop/src/renderer/atoms/browser-actions.ts:6` and a best-effort single-cursor overlay in `apps/desktop/src/renderer/components/side-panel/browser-cursor-overlay.tsx:37`.
- Existing planning work already established the streamed-lane direction in `.sisyphus/plans/palot-browser-lane-virtual-stream.md` and the browser+cursor overlay direction in `.sisyphus/plans/palot-browser-side-panel-opencode-magic-browser-cursor.md`.

Implication: the browser panel should evolve from **single-view streamed lane + fake action playback** to **shared remote browser + first-class presence**, not restart from scratch.

### Palot plugin/runtime seam <!-- oc:id=sec_af -->

The OpenCode bridge architecture already gives a place to project browser control into agent tooling:

- `docs/palot-opencode-plugin-bridge.md` documents the current desktop-first, managed-server-first plugin seam.
- The bridge already routes browser tool dispatch through authoritative main-process state and browser lane operations.
- `palot` already treats plugin-contributed UI + agent/runtime capabilities as converging architecture in `.sisyphus/plans/firefly-plugin-system-v2.md`.

Implication: multiplayer browser state should be exposed through the same plugin/runtime bridge shape that other Firefly capabilities are converging toward.

### Magic Browser <!-- oc:id=sec_ag -->

`magic-browser` already has the browser-generic control/runtime language Chris wants to preserve:

- Adapters: `local-cdp`, `remote-cdp`, `browser-use-cdp` in `README.md:106` and `src/cli.ts:295`.
- Large browser-generic CLI surface for start/open/snapshot/click/type/eval/extract/workflow execution in `src/cli.ts:284`.
- Raw CDP runtime and page/session logic in `src/runtime/cdp.ts:6`.
- Viewer/control stack with `ViewerClient` in `packages/viewer/src/viewer-client.ts:32`.
- Lease-gated input relay in `packages/viewer/src/input-relay.ts:15`.
- Remote-managed vs local-managed parity doctrine in `README.md` and AGENTS docs.

Implication: **agent actions should flow through Magic Browser semantics**, not through a palot-only bespoke browser automation layer.

### Ghost Browser <!-- oc:id=sec_ah -->

`ghost-browser` is the strongest proof-of-concept prior art in the portfolio:

- It already has a `Page.startScreencast` pipeline broadcasting JPEG frames over WebSocket.
- It already has viewer input forwarding.
- It already has lease/control concepts and attached-browser collaboration semantics.
- It already proves the runtime value of separating browser session authority from viewer/client surfaces.

Implication: use Ghost as design proof and code-pattern reference; do not require a runtime dependency on Ghost for P1 unless later proven necessary.

### ch5-packages <!-- oc:id=sec_ai -->

`ch5-packages` already contains useful rendering primitives:

- Human-like cursor motion in `packages/motion/motion/src/HumanCursor.tsx:23`.
- Existing fake labeled cursor UI in `packages/web/magic-browser-viewer-web/src/FakeCursorLayer.tsx:6`.
- Existing browser-shell composition in `packages/web/magic-browser-viewer-web/src/BrowserShell.tsx:13`.

Implication: P2 should reuse these cursor/motion assets rather than introducing a new cursor library.

### Loom <!-- oc:id=sec_aj -->

Loom is relevant but not the immediate trunk:

- `.sisyphus/plans/loom-implementation-plan.md:28` and following positions Loom as a typed bidirectional UI protocol.
- `.sisyphus/plans/loom-implementation-plan.md:40` explicitly excludes CRDT/multi-human collaboration in v0.

Implication: the multiplayer browser may eventually become a Loom-rendered/polled surface, but Loom should not block the first remote-browser milestone.

## Architecture recommendation <!-- oc:id=sec_ak -->

## 1. Browser host <!-- oc:id=sec_al -->

### Recommended default host model <!-- oc:id=sec_am -->

Treat the remote browser as a **managed remote browser lane**:

- A Chrome/Chromium instance lives on a host outside the local client.
- That host exposes:
  - a CDP endpoint,
  - a stream endpoint or frame feed,
  - a session identity,
  - an auth boundary,
  - optional live-view URLs for debugging/takeover.

### Candidate host backends <!-- oc:id=sec_an -->

Supported hosting backends should stay behind one abstraction:

- first-party `remote-cdp` host,
- Browser Use / Browser Use Cloud-compatible host,
- future containerized host on sprite.dev / Hetzner / Dell / other boxes.

### Recommendation <!-- oc:id=sec_ao -->

For this plan, standardize the host-facing contract around:

```ts
BrowserSessionHost = {
  sessionId: string
  cdpWebSocketUrl: string
  liveStreamUrl?: string
  frameSocketUrl?: string
  providerKind: "remote-cdp" | "browser-use-cdp" | "attached"
  authToken: string
  metadata: {
    label: string
    host: string
    ownerUserId?: string
  }
}
```

This keeps `magic-browser` generic while allowing `palot` to bind a visible session to the panel.

## 2. Stream transport <!-- oc:id=sec_ap -->

### Recommendation: WebSocket/JPEG screencast first <!-- oc:id=sec_aq -->

For the first true remote mode milestone, use a **CDP screencast -> server fan-out -> WebSocket frames -> iframe/viewer surface** pipeline.

Why:
- Ghost already proves this shape.
- It is much easier to implement and debug than introducing WebRTC/SFU immediately.
- It matches the current portfolio’s same-origin panel strategy.
- It is good enough for **single-stream, small-room, control-centric** usage.

### Not recommended for P1 <!-- oc:id=sec_ar -->

Do **not** start with WebRTC as the required transport for P1.

Reasons:
- More moving parts: SDP, ICE, NAT, TURN, media pipeline, reconnection semantics.
- It solves scaling and latency problems that are real, but not the first blocker.
- The product risk for P1 is control/session semantics, not 100-viewer video economics.

### P1 target constraints <!-- oc:id=sec_as -->

P1 should explicitly target:
- 1 visible streamed browser session,
- 1-5 passive viewers,
- 1 active control lease holder,
- acceptable latency for navigation, clicks, form fill, and read/debug tasks.

### P3+ upgrade path <!-- oc:id=sec_at -->

When room size or latency needs exceed WS/JPEG comfort, upgrade the transport layer behind the same session contract:
- WebRTC direct or SFU-backed for pixels,
- same control/presence protocol,
- same browser session authority.

## 3. Input event path <!-- oc:id=sec_au -->

### Human input <!-- oc:id=sec_av -->

Human input should not “click through directly” in an ungoverned way. It should be:

1. user interacts with the panel viewer surface, <!-- oc:id=item_ac -->
1. panel converts rendered coordinates -> viewport coordinates, <!-- oc:id=item_ad -->
1. input message is sent to the runtime, <!-- oc:id=item_ae -->
1. runtime validates control lease + session state, <!-- oc:id=item_af -->
1. runtime dispatches CDP input events to the active page target. <!-- oc:id=item_ag -->

Use the same primitive family already visible in `apps/desktop/src/main/browser-lane-cdp.ts:110`:
- `Input.dispatchMouseEvent`
- `Input.insertText`
- `Input.dispatchKeyEvent`
- `mouseWheel`

### Agent input <!-- oc:id=sec_aw -->

Agent input should not bypass the runtime just because it is “virtual”.

Agent path should be:

1. OpenCode tool call or CLI action, <!-- oc:id=item_ah -->
1. Palot bridge resolves session binding, <!-- oc:id=item_ai -->
1. action is dispatched to Magic Browser session authority, <!-- oc:id=item_aj -->
1. Magic Browser emits structured action event(s), <!-- oc:id=item_ak -->
1. runtime sends CDP action, <!-- oc:id=item_al -->
1. viewer presence layer receives the same action event for ghost cursor playback. <!-- oc:id=item_am -->

### Key rule <!-- oc:id=sec_ax -->

**Humans and agents must converge onto the same browser session authority and input relay**, even if their UI affordances differ.

## 4. Presence protocol <!-- oc:id=sec_ay -->

### Recommendation <!-- oc:id=sec_az -->

Presence should be an **ephemeral socket protocol**, not CRDT-backed shared state, for P2.

Cursor presence messages should look like:

```ts
type PresenceCursorMessage = {
  sessionId: string
  participantId: string
  participantKind: "human" | "agent"
  displayName: string
  color: string
  cursor: {
    x: number
    y: number
    pressed?: boolean
    hidden?: boolean
  }
  action?: {
    kind: "move" | "click" | "type" | "scroll" | "hover" | "checkpoint"
    label?: string
  }
  ts: number
}
```

### Why not CRDT here <!-- oc:id=sec_ba -->

Cursor positions are transient and high-frequency. They should be treated as ephemeral presence, not durable collaborative document state.

### Rendering model <!-- oc:id=sec_bb -->

- Render cursors in a pointer-events-none overlay above the stream surface.
- Interpolate between pushed positions on the client.
- Distinguish humans vs agents visually:
  - human cursor: direct pointer styling,
  - agent cursor: ghost cursor with motion easing / small label pill / optional trail.

### Reuse <!-- oc:id=sec_bc -->

Start from:
- `palot`’s existing overlay composition,
- `ch5-packages` `HumanCursor`,
- `FakeCursorLayer` semantics from `magic-browser-viewer-web`.

## 5. Control and conflict model <!-- oc:id=sec_bd -->

### Recommendation: single active input lease holder <!-- oc:id=sec_be -->

Do **not** implement true simultaneous multi-human control first.

The right first model is:
- any number of passive viewers,
- one active control lease holder at a time,
- visible presence from everyone,
- lease transfer/request semantics,
- agent actions treated as another controller identity class.

This aligns with existing Magic Browser viewer semantics and avoids chaos.

### Why <!-- oc:id=sec_bf -->

Without a lease model:
- two humans can issue overlapping clicks/types,
- agent and human can fight over focus, text fields, scroll, and modal state,
- “clicks pass straight through” becomes nondeterministic under latency.

### Ordering <!-- oc:id=sec_bg -->

Use runtime sequencing:
- every input/action event gets sequence + timestamp,
- runtime remains authoritative on accepted order,
- rejected inputs return explicit reason:
  - `lease-not-held`
  - `checkpoint-blocks-input`
  - `approval-pending`
  - `stale-session`

### P2/P3 semantics <!-- oc:id=sec_bh -->

- **P2**: multiple visible cursors, single control lease holder.
- **P3**: multi-human shared session with explicit transfer/queue/override semantics.

If simultaneous control is ever desired later, add it intentionally with scoped affordances; do not smuggle it into the MVP.

## 6. Auth and session sharing model <!-- oc:id=sec_bi -->

### Session identity <!-- oc:id=sec_bj -->

The shared browser session needs three distinct identities:
- browser runtime session id,
- Firefly/Palot binding id,
- participant identity per viewer/agent.

### Recommendation <!-- oc:id=sec_bk -->

Session sharing should require a **session-scoped viewer/control token**, not just a generic user auth cookie.

Minimal model:
- authenticated user creates or opens shared browser session,
- runtime mints scoped token(s):
  - viewer token,
  - control-request token,
- Firefly clients connect using their authenticated user context + session-scoped token.

### Requirements <!-- oc:id=sec_bl -->

- Viewer tokens are read-only by default.
- Control must be explicitly requested/leased.
- Tokens must be revocable.
- Session should know owner + participants.
- Remote host credentials must never be exposed to the renderer.

### Important non-goal <!-- oc:id=sec_bm -->

Do **not** make browser session sharing depend on the renderer knowing raw CDP secrets.

## 7. Loom stance <!-- oc:id=sec_bn -->

### Recommendation <!-- oc:id=sec_bo -->

Use Loom as an **eventual projection target**, not the prerequisite substrate for P1.

### Why <!-- oc:id=sec_bp -->

Loom is valuable for:
- typed bidirectional surface protocols,
- component registry / signal-state split,
- future generalized multiplayer UI surfaces.

But Loom’s current plan explicitly avoids multi-human/CRDT complexity. For this browser effort, forcing Loom into the critical path too early would risk blocking the first useful shared-browser milestone.

### Practical stance <!-- oc:id=sec_bq -->

- P0/P1/P2 can ship on the current panel/plugin/runtime seams.
- Keep the presence/control schema typed and Loom-compatible.
- When Loom matures, re-project the browser session/presence/control surface into Loom rather than rewrite the browser runtime to fit Loom prematurely.

## Runtime decomposition <!-- oc:id=sec_br -->

### Firefly / palot responsibilities <!-- oc:id=sec_bs -->

`palot` should own:
- side-panel UI,
- panel mode switching (`local` vs `remote`),
- OpenCode session binding,
- session-to-browser binding display state,
- cursor overlay rendering,
- plugin/runtime projection for browser tools.

### Magic Browser responsibilities <!-- oc:id=sec_bt -->

`magic-browser` should own:
- browser-generic session lifecycle,
- adapter abstraction (`local-cdp`, `remote-cdp`, `browser-use-cdp`),
- agent-facing browser commands/actions,
- session authority, checkpoint, takeover, and provider semantics,
- structured agent action events.

### Shared host/runtime responsibilities <!-- oc:id=sec_bu -->

The remote browser host should own:
- Chrome process/container lifecycle,
- CDP endpoint exposure,
- screencast/frame capture,
- stream fan-out,
- viewer/control token validation,
- session metadata.

### Ghost Browser role <!-- oc:id=sec_bv -->

`ghost-browser` should contribute:
- prior-art implementation patterns,
- possible code borrowing/reference for screencast + lease + input pathways,
- maybe future host runtime ideas.

But P1 should not depend on Ghost being installed or embedded as a runtime prerequisite.

## Recommended technical shape by phase <!-- oc:id=sec_bw -->

## P0 — Local mode baseline <!-- oc:id=sec_bx -->

### Goal <!-- oc:id=sec_by -->

Keep a simple, always-available Browser panel mode that can point an iframe at a URL.

### Scope <!-- oc:id=sec_bz -->

- Explicit mode switch: `local` / `remote`.
- `local` mode = plain iframe wrapper.
- Persist entered URL locally.
- Surface honest fallback UI for iframe-restricted sites.

### Notes <!-- oc:id=sec_ca -->

This mode is not the “multiplayer” win; it is the stable fallback and panel contract baseline.

## P1 — Remote streamed browser, single visible session <!-- oc:id=sec_cb -->

### Goal <!-- oc:id=sec_cc -->

Show one hosted browser session in the panel with separate stream plane and CDP/control plane.

### Scope <!-- oc:id=sec_cd -->

- Create/open remote browser session.
- Render stream in browser panel via same-origin viewer surface.
- Route agent actions through Magic Browser / CDP.
- Optional human takeover only through explicit control lease.
- Show session health:
  - stream ready,
  - CDP ready,
  - control available,
  - checkpoint waiting.

### Recommendation <!-- oc:id=sec_ce -->

Use WebSocket + JPEG screencast fan-out first.

### Must not do <!-- oc:id=sec_cf -->

- No multi-cursor yet.
- No simultaneous control.
- No WebRTC-first mandate.
- No Ghost runtime dependency.

## P2 — Presence layer: humans + agents <!-- oc:id=sec_cg -->

### Goal <!-- oc:id=sec_ch -->

Overlay multiple labeled cursors on the same remote browser session.

### Scope <!-- oc:id=sec_ci -->

- Socket-fed presence messages.
- Stable participant colors and labels.
- Human cursors visible even when not holding control.
- Agent ghost cursors rendered from actual action events.
- Interpolation for smooth motion.
- Distinct visual language for human vs agent presence.

### Rendering notes <!-- oc:id=sec_cj -->

- Reuse `HumanCursor` for motion behavior where useful.
- Reuse `FakeCursorLayer` styling concepts.
- Replace single-cursor `browser-cursor-overlay.tsx` assumptions with participant collections.

### Must not do <!-- oc:id=sec_ck -->

- No durable CRDT cursor state.
- No “fake only” agent playback divorced from real accepted action events.

## P3 — Multi-human shared control <!-- oc:id=sec_cl -->

### Goal <!-- oc:id=sec_cm -->

Allow multiple Firefly clients to share the same remote browser session with robust lease/transfer semantics.

### Scope <!-- oc:id=sec_cn -->

- Viewer roster.
- Control request / grant / release / timeout.
- Ownership indicators.
- Session-scoped auth model across independent clients.
- Recovery on disconnect/reconnect.
- Explicit arbitration policy.

### Arbitration recommendation <!-- oc:id=sec_co -->

Start with:
- one lease holder,
- last explicit granted controller wins,
- visible transfer prompts and status.

### Must not do <!-- oc:id=sec_cp -->

- No hidden implicit simultaneous input.
- No raw shared CDP credentials in clients.

## Ticket breakdown <!-- oc:id=sec_cq -->

## T0. Research synthesis + contract alignment <!-- oc:id=sec_cr -->

Deliverables:
- align this plan against prior lane/browser/cursor/Loom/plugin plans,
- define canonical terms: browser lane, remote session, participant, lease, presence event.

## T1. Browser mode split in panel <!-- oc:id=sec_cs -->

Deliverables:
- explicit `local` vs `remote` mode in Browser panel,
- baseline iframe flow retained for local mode,
- remote mode placeholder shell and state machine.

Files likely touched:
- `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx`
- browser atoms/types used by panel state

## T2. Remote session descriptor + binding model <!-- oc:id=sec_ct -->

Deliverables:
- session descriptor schema,
- OpenCode session -> browser session binding,
- participant/session metadata model.

Files likely touched:
- main-process browser/session binding store
- shared bridge schemas
- plugin bridge/runtime seam

## T3. Remote browser host adapter <!-- oc:id=sec_cu -->

Deliverables:
- host adapter abstraction for remote browser session creation/attach,
- support for `remote-cdp` and/or Browser Use-compatible host,
- health checks for stream plane and CDP plane separately.

## T4. Stream viewer integration <!-- oc:id=sec_cv -->

Deliverables:
- same-origin stream/viewer route embedded in Browser panel,
- reconnect and degraded-state handling,
- diagnostics surface.

## T5. Agent action event stream <!-- oc:id=sec_cw -->

Deliverables:
- structured action-event bus for accepted browser actions,
- event schema carries participant, coords, action kind, sequence, confidence.

This is the key source for agent ghost cursors.

## T6. Presence socket protocol <!-- oc:id=sec_cx -->

Deliverables:
- participant connect/disconnect model,
- ephemeral cursor-position events,
- label/color assignment,
- interpolation-friendly client payloads.

## T7. Multi-cursor overlay renderer <!-- oc:id=sec_cy -->

Deliverables:
- replace single-cursor assumptions with N cursors,
- human vs agent visuals,
- motion smoothing and badge system,
- viewport/geometry reconciliation.

Likely reuse:
- `browser-cursor-overlay.tsx`
- `HumanCursor`
- `FakeCursorLayer`

## T8. Lease / control model <!-- oc:id=sec_cz -->

Deliverables:
- request/release/transfer semantics,
- control denial reasons,
- runtime enforcement for both human and agent inputs,
- visible UI control indicators.

## T9. Shared-client auth and session sharing <!-- oc:id=sec_da -->

Deliverables:
- session-scoped viewer/control tokens,
- participant roster/auth wiring,
- revocation and reconnect semantics.

## T10. Remote proof lane <!-- oc:id=sec_db -->

Deliverables:
- end-to-end proof against a real remote host,
- one human viewer + one agent,
- then two human viewers + one agent,
- evidence artifacts and recovery checks.

## Risks and mitigations <!-- oc:id=sec_dc -->

### Risk 1: transport over-ambition <!-- oc:id=sec_dd -->

If P1 starts with WebRTC/SFU, the work may drown in media infrastructure before session semantics are proven.

Mitigation:
- WS/JPEG screencast first.
- WebRTC later only if required by measured latency/scale.

### Risk 2: fake cursor lies <!-- oc:id=sec_de -->

If agent cursors are rendered from optimistic intent rather than accepted runtime actions, the UI will drift from reality.

Mitigation:
- only render ghost cursor actions from accepted/acknowledged runtime events.
- preserve confidence/drift metadata.

### Risk 3: simultaneous control chaos <!-- oc:id=sec_df -->

Allowing uncontrolled direct human clicks from multiple viewers will create nondeterministic state.

Mitigation:
- single control lease holder first.
- visible request/transfer flow.

### Risk 4: auth leakage <!-- oc:id=sec_dg -->

If renderer clients learn raw CDP endpoints/tokens casually, the session-sharing model becomes fragile and unsafe.

Mitigation:
- session-scoped viewer/control tokens,
- no renderer-held long-lived infra credentials,
- server-side dispatch of control actions.

### Risk 5: Loom coupling too early <!-- oc:id=sec_dh -->

Trying to make Loom the prerequisite could delay the actual browser milestone.

Mitigation:
- keep schemas Loom-friendly,
- do not make Loom a blocker for P1/P2.

## Verification requirements <!-- oc:id=sec_di -->

Every implementation phase should prove:

### P0 verification <!-- oc:id=sec_dj -->

- Browser tab opens.
- Local iframe mode loads allowed sites.
- Honest failure state for iframe-blocked sites.

### P1 verification <!-- oc:id=sec_dk -->

- Remote session can be created or attached.
- Stream renders in panel.
- CDP navigation changes visible stream.
- Human can request/hold/release control.
- Agent action route works through Magic Browser semantics.

### P2 verification <!-- oc:id=sec_dl -->

- Two or more cursors render simultaneously.
- Agent cursor plays accepted actions.
- Human cursor positions interpolate smoothly.
- No full-tree re-render path under frequent cursor updates.

### P3 verification <!-- oc:id=sec_dm -->

- Two independent Firefly clients can watch the same session.
- Lease transfer works.
- Disconnect/reconnect preserves session health.
- Rejected inputs are explicit and observable.

## Final recommendation <!-- oc:id=sec_dn -->

The strongest architecture is:

- **Palot panel + plugin/runtime seam** as the UI and session-binding host,
- **Magic Browser** as the browser-generic control/session authority,
- **remote browser host** behind `remote-cdp` / Browser Use-compatible adapter contracts,
- **WS/JPEG screencast first** for P1,
- **ephemeral socket presence** for P2,
- **single input lease holder** for the first shared-control model,
- **Loom-compatible but not Loom-blocked** implementation sequence,
- **Ghost Browser as prior art/reference**, not a hard dependency.

This keeps the work aligned with the existing CH5 browser stack, avoids a giant rewrite, and gives Chris a real path from today’s browser panel to a true multiplayer browser surface.