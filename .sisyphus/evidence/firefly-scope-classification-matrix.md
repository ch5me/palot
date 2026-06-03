# Firefly scope classification matrix <!-- oc:id=sec_aa -->

## Ship now <!-- oc:id=sec_ab -->
- Registry foundation: review, notes, pulse, memory shell entries via `apps/desktop/src/renderer/firefly-surface-registry.tsx`
- Shell persistence/focus path in `apps/desktop/src/renderer/atoms/ui.ts` and `apps/desktop/src/renderer/atoms/preferences.ts`
- Notes proof surface shell in `apps/desktop/src/renderer/components/side-panel/notes-panel.tsx`

## Task 7 audit
- Notes currently use local `useState` only, so draft persistence, autosave restore, and cross-session durability are still missing.
- Palot already has reusable draft infrastructure in `apps/desktop/src/renderer/hooks/use-draft.ts`, backed by `draftsAtom` in `apps/desktop/src/renderer/atoms/preferences.ts`.
- Chat already proves the intended send-to-AI seam via `onSendMessage(agent, message, options)` in `apps/desktop/src/renderer/components/agent-detail.tsx` and `apps/desktop/src/renderer/components/chat/chat-input.tsx`.
- No backend/preload seam for notes storage exists yet; current surface is renderer-only scaffolding.

## Task 8 audit
- Pulse currently renders static card copy in `apps/desktop/src/renderer/components/side-panel/pulse-panel.tsx` and does not consume real metrics atoms.
- Existing live metrics primitives already exist in `apps/desktop/src/renderer/components/session-metrics-bar.tsx` and `apps/desktop/src/renderer/lib/session-metrics.ts` for work time, cost, tokens, exchanges, and model distribution.
- Agent/session metadata already exposes branch and worktree fields through `apps/desktop/src/renderer/lib/types.ts`.
- Automation state already has backend and atom seams (`services/backend.ts`, `atoms/automations.ts`) that can feed the pulse surface later.
- Recharts is already available via `packages/ui/src/components/chart.tsx` and `packages/ui/package.json`, so charting is not a package blocker if richer visuals are needed.

## Task 9 audit
- Memory surface is still staged copy in `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx`; no real retrieval/list/search flow is wired.
- Shell gating is already correct for a risky surface: registry entry exists in `apps/desktop/src/renderer/firefly-surface-registry.tsx` and the feature flag defaults OFF in `apps/desktop/src/renderer/atoms/feature-flags.ts`.
- No memory backend contract exists in `apps/desktop/src/renderer/services/backend.ts` or preload/main seams today.
- Existing OpenCode project/session listing services may provide a first low-risk fallback list surface before any graph work.

## Track 6 / 7 audit
- Palot README and router confirm strong existing coverage for review and automations, but do not expose first-class terminal/files/plugins/voice surfaces yet.
- Current route-level product map in renderer is still narrow: worktrees and automations are routed, while missing Supra domains like terminal/files/plugins/voice are absent as dedicated surfaces.
- Track 7 risk is still real: Palot local dev currently relies on `workspace:*` links for multiple internal packages, while AGENTS and handoff docs say published-semver consumption is the release-safe direction for cross-repo consumers.
- Firefly-cloud seam status is mixed: handoff says split-package guardrails are verified, but published-semver consumption is still deferred for release paths.

## Ship flagged <!-- oc:id=sec_ac -->
- Browser surface: exists as placeholder in `apps/desktop/src/renderer/components/side-panel/browser-panel.tsx`; should stay flag-gated until real native service lands
- Pulse surface: shell exists in `apps/desktop/src/renderer/components/side-panel/pulse-panel.tsx`; still telemetry-light, keep as staged/flagged
- Memory surface: shell exists in `apps/desktop/src/renderer/components/side-panel/memory-panel.tsx`; default-off remains correct until real substrate lands
- Skills/plugins catalog: listed in implementation scope as optional/default-off, not urgent for core Firefly proof

## Defer <!-- oc:id=sec_ad -->
- Database workbench
- Voice capture / transcription expansion
- Windows validation
- Packaging, signing, notarization, auto-update hardening
- CI polish beyond direct blockers
- Package publishing migration work

## Drop / not current priority <!-- oc:id=sec_ae -->
- CRM / contacts as product focus
- Bridges as product focus
- Motion / studio as product focus
- Broad secondary-engine expansion beyond explicit adapter decisions
- Broad AIOS parity outside approved Firefly surfaces

## Rationale <!-- oc:id=sec_af -->
- Current Palot implementation already covers Tasks 1-4 and the playbook/deferred policy foundations.
- Proof surfaces still differ in maturity: Notes is real enough to iterate, Browser is still placeholder, Pulse is static, Memory is staged copy.
- Core native-daily-driver priorities remain terminal, browser, files/review, auth, telemetry, billing, and shared seam work.