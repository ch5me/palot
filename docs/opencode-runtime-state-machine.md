# OpenCode Runtime State Machine <!-- oc:id=sec_aa -->

Freezes the runtime choice and lifecycle state machine for the alpha launch. This document is the contract between onboarding, persistent settings, and the runtime manager. Downstream UI, settings, and verification tasks implement against this table, not against ad hoc assumptions.

## Reader and purpose <!-- oc:id=sec_ab -->

The reader is an engineer implementing onboarding steps, settings UI, or the runtime manager. After reading, they can answer: which runtime modes exist, what states each mode passes through, what happens on failure, and which file owns each piece of the flow.

## Scope <!-- oc:id=sec_ac -->

Two state domains:

- Onboarding states: first-run only. These gates disappear once the user finishes setup.
- Persistent settings states: live for the lifetime of the app. They track the active runtime mode and its health between launches.

## Runtime modes <!-- oc:id=sec_ad -->

Each row is a first-class runtime mode. The onboarding picker and the settings panel must expose all three. No mode is hidden behind another mode's failure.

| Mode | ID | Lifecycle owner | Alpha status |
|------|----|-----------------|--------------|
| Bundled Local | `bundled-local` | App manages the bundled portable-opencode binary | Recommended default |
| Existing Local | `existing-local` | User manages their own host OpenCode server; app attaches | First-class secondary |
| Remote HTTP | `remote-http` | External server; app connects over HTTP | First-class secondary |

## Onboarding states <!-- oc:id=sec_ae -->

These states run once during first launch. The onboarding overlay walks through them in order, with branches for failure and legacy upgrade.

| State | ID | Trigger / entry condition | Exit condition |
|-------|----|--------------------------|----------------|
| Welcome | `welcome` | App launches for the first time | User clicks Continue |
| Runtime Scan | `runtime-scan` | Welcome completes | Scan finishes; available runtimes identified |
| Runtime Choice | `runtime-choice` | Scan completes; user sees all three modes | User picks a mode |
| Bundled Verify | `bundled-verify` | User selects bundled-local | Binary check passes or fails |
| Existing Verify | `existing-verify` | User selects existing-local | Port probe succeeds or fails |
| Remote Verify | `remote-verify` | User selects remote-http | URL connection test passes or fails |
| Bundled Missing | `bundled-missing` | Bundled artifact not found in packaged build | User picks repair/reinstall or chooses another mode |
| Bundled Broken Repairable | `bundled-broken-repairable` | Bundled binary exists but fails version or integrity check | Repair action succeeds or user falls back |
| Remote Offline | `remote-offline` | Remote URL fails connection test | User retries, edits URL, or picks another mode |
| Legacy Upgrade | `legacy-upgrade` | Scan detects pre-bundled config with host-opencode dependency | User confirms migration to bundled-local or keeps existing |
| Provider Setup | `provider-setup` | Any runtime verified successfully | User configures at least one provider or skips |
| Onboarding Complete | `onboarding-complete` | Provider setup finishes or is skipped | Onboarding overlay closes; app enters main UI |

## Persistent settings states <!-- oc:id=sec_af -->

These states live in persisted server settings and runtime health. They survive restarts.

| State | ID | Scope | Description |
|-------|----|-------|-------------|
| Active Runtime Mode | `active-runtime-mode` | Settings | Which mode is currently selected: bundled-local, existing-local, or remote-http |
| Runtime Healthy | `runtime-healthy` | Health | Active runtime responds to health probe; normal operation |
| Runtime Starting | `runtime-starting` | Health | Managed runtime is booting; waiting for readiness |
| Runtime Degraded | `runtime-degraded` | Health | Runtime responds but reports non-fatal issues |
| Bundled Crash | `bundled-crash` | Failure | Managed bundled runtime exited unexpectedly after onboarding |
| Remote Disconnected | `remote-disconnected` | Failure | Remote HTTP server stopped responding |
| Legacy Config Detected | `legacy-config-detected` | Migration | Pre-bundled settings found on app launch; needs migration |

## Transitions: bundled-local <!-- oc:id=sec_ag -->

Happy path:

| From | To | Trigger |
|------|----|---------|
| runtime-choice | bundled-verify | User selects bundled-local |
| bundled-verify | provider-setup | Binary check passes; version and integrity OK |
| provider-setup | onboarding-complete | Provider configured or skipped |
| onboarding-complete | runtime-healthy | App enters main UI; managed runtime responds |

Failure path:

| From | To | Trigger |
|------|----|---------|
| runtime-scan | bundled-missing | No bundled artifact found in packaged build |
| bundled-missing | bundled-broken-repairable | Artifact exists but fails integrity check |
| bundled-missing | runtime-choice | User chooses a different mode |
| bundled-broken-repairable | bundled-verify | Repair or reinstall action succeeds |
| bundled-broken-repairable | runtime-choice | User gives up on bundled and picks another mode |
| runtime-healthy | bundled-crash | Managed runtime process exits unexpectedly |
| bundled-crash | runtime-starting | App auto-restarts the managed runtime |
| runtime-starting | runtime-healthy | Restarted runtime passes readiness probe |
| runtime-starting | bundled-crash | Restart fails; app surfaces manual restart option |

## Transitions: existing-local <!-- oc:id=sec_ah -->

Happy path:

| From | To | Trigger |
|------|----|---------|
| runtime-choice | existing-verify | User selects existing-local |
| existing-verify | provider-setup | Same-user port probe succeeds |
| provider-setup | onboarding-complete | Provider configured or skipped |
| onboarding-complete | runtime-healthy | Attached server responds to health check |

Failure path:

| From | To | Trigger |
|------|----|---------|
| runtime-scan | existing-verify | Scan finds a same-user listener but user must confirm |
| existing-verify | runtime-choice | No listener found on expected ports; user picks another mode |
| existing-verify | runtime-choice | Listener belongs to a different user; conflict, fail loud |
| runtime-healthy | runtime-degraded | Attached server stops responding intermittently |
| runtime-degraded | runtime-healthy | Server recovers |
| runtime-degraded | runtime-choice | Server stays down; user switches mode |

## Transitions: remote-http <!-- oc:id=sec_ai -->

Happy path:

| From | To | Trigger |
|------|----|---------|
| runtime-choice | remote-verify | User selects remote-http and provides URL |
| remote-verify | provider-setup | Connection test passes with optional auth |
| provider-setup | onboarding-complete | Provider configured or skipped |
| onboarding-complete | runtime-healthy | Remote server responds to periodic health probe |

Failure path:

| From | To | Trigger |
|------|----|---------|
| remote-verify | remote-offline | Connection test fails; server unreachable |
| remote-offline | remote-verify | User edits URL or retries after network change |
| remote-offline | runtime-choice | User picks a different mode |
| runtime-healthy | remote-disconnected | Periodic health probe fails |
| remote-disconnected | runtime-healthy | Server comes back online |
| remote-disconnected | runtime-choice | User switches to a local mode |

## Transitions: core onboarding flow <!-- oc:id=sec_am -->

These transitions connect the linear backbone of the onboarding overlay. Mode-specific verify transitions are in the per-mode sections above.

| From | To | Trigger |
|------|----|---------|
| welcome | runtime-scan | User clicks Continue on the welcome screen |
| runtime-scan | runtime-choice | Scan finishes; available runtimes identified |
| runtime-scan | legacy-upgrade | Scan detects pre-bundled config with host-opencode dependency |

## Transitions: legacy upgrade <!-- oc:id=sec_aj -->

| From | To | Trigger |
|------|----|---------|
| runtime-scan | legacy-upgrade | Scan finds host-opencode config from pre-bundled app version |
| legacy-upgrade | bundled-verify | User accepts migration to bundled-local |
| legacy-upgrade | existing-verify | User keeps existing host server; app records attach-only ownership |
| runtime-healthy | legacy-config-detected | App restart detects old settings format |
| legacy-config-detected | runtime-healthy | Migration runs and settings are rewritten |

## Transitions: packaged restart <!-- oc:id=sec_ak -->

| From | To | Trigger |
|------|----|---------|
| runtime-healthy | runtime-starting | App restarts; managed runtime needs to boot |
| runtime-starting | runtime-healthy | Bundled runtime passes readiness probe on configured port |
| runtime-starting | bundled-crash | Bundled runtime fails to start within timeout |
| bundled-crash | runtime-choice | Auto-restart exhausted; user must pick a different mode or retry |

## Source file references <!-- oc:id=sec_al -->

These files own or will own the behavior described above. The verifier checks that each cited path exists in the repo.

| Path | Role |
|------|------|
| `apps/desktop/src/renderer/components/onboarding/onboarding-overlay.tsx` | Onboarding step orchestration |
| `apps/desktop/src/renderer/components/onboarding/steps/environment-check-step.tsx` | Current environment check (to be replaced by runtime choice) |
| `apps/desktop/src/renderer/components/settings/server-settings.tsx` | Persistent server settings UI |
| `packages/ui/src/stories/ai-elements/opencode-setup-flow.stories.tsx` | Storybook decision board for setup flow |
| `docs/opencode-runtime-packaging-alpha-plan.md` | Parent plan document |

## Invariants <!-- oc:id=sec_am -->

1. All three modes (bundled-local, existing-local, remote-http) are always reachable from the runtime choice screen. No mode is gated behind another mode's failure. <!-- oc:id=item_aa -->
1. The onboarding overlay cannot reach provider-setup without passing through a verify state for the chosen mode. <!-- oc:id=item_ab -->
1. Persistent settings always record which mode is active. A server config without a runtime mode is incomplete. <!-- oc:id=item_ac -->
1. Failure states are recoverable. Every failure state has at least one transition back to a verify state or to runtime-choice. <!-- oc:id=item_ad -->
1. Legacy upgrade is detected during runtime-scan, not as a separate onboarding step. It intercepts the flow before runtime-choice. <!-- oc:id=item_ae -->
1. Packaged restart goes through runtime-starting before reaching runtime-healthy. The app never assumes a managed runtime is ready without a readiness probe. <!-- oc:id=item_af -->