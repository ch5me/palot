# Task 11 — Plugin Host Isolation, Crash Supervision, and Quarantine <!-- oc:id=sec_aa -->

> Wave 2, Task 11 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## What this means for V2 <!-- oc:id=sec_ab -->

Every plugin runs in its own worker; the host supervises the worker; the host is the only authoritative path for plugin state. A bad plugin must never crash the host, leak memory indefinitely, or persist state outside the host-owned store. The supervisor is responsible for: heartbeats, crash counters, exponential backoff, quarantine on repeated failure, and operator recovery.

## 1. Process model <!-- oc:id=sec_ac -->

Two-tier isolation:

- Plugin host: one Electron `utilityProcess` per host session; runs at OS user privilege, no renderer DOM access
- Plugin workers: one `worker_thread` per activated plugin inside the plugin host

The plugin host acts as the supervisor. It boots the manifest catalog at host startup, reads installed plugin packages from disk, instantiates worker threads for activated plugins, and exposes a tiny host API surface to them. Workers cannot reach back into Electron main globals or the renderer DOM.

Transport: each worker is paired with a `MessagePort` provided by the host. The host buffers envelopes; the worker never sees the renderer. All dispatch goes worker -> host -> broker -> authority.

Worker memory limits (defaults, overridable per plugin via manifest in future tier):
- `maxOldGenerationSizeMb`: 256
- `maxYoungGenerationSizeMb`: 32
- `codeRangeSizeMb`: 32
- `stackSizeMb`: 4

A single runaway plugin cannot exhaust the host process under this model because each worker is a separate V8 isolate with explicit limits.

## 2. Plugin worker lifecycle state machine <!-- oc:id=sec_ad -->

```
discovered
   |
   v
validated
   |
   v
installed
   |
   v
disabled <-----> activating -----> active
                  |                  |
                  v                  v
                failed           degraded
                                     |
                                     v
                                 quarantined
                                     |
                                     v
                                  removed

(cancelled activation can drop to disabled or fall back to removed depending on cause)
```

States:

- `discovered` — manifest parsed; trust tier classified; package on disk
- `validated` — Zod manifest passed; capability and contribution checks passed; activation prerequisites met
- `installed` — bundle unpacked; runtime slot reserved
- `disabled` — present on disk but not running; user or operator choice
- `activating` — supervisor is spinning up the worker
- `active` — worker running, accepting calls
- `degraded` — worker running but health check failing; calls still accepted at lower priority
- `failed` — activation failed; supervisor can retry
- `quarantined` — too many crashes; supervisor refuses activation until cleared
- `removed` — uninstalled; bundle and state purged

## 3. Crash, hang, partial-activation handling <!-- oc:id=sec_ae -->

Per failure class:

| Failure class | Detection | Action |
|---|---|---|
| Activation crash | worker exits non-zero within 5s of `activating -> active` | increment `activationCrashCount`; on count >= 3, quarantine |
| Runtime crash | worker exits non-zero while `active` or `degraded` | increment `crashCount`; on count >= 3 within 5 minutes, quarantine |
| Worker hang | heartbeat missed for `hangTimeoutMs` (default 30s) | SIGTERM, restart attempt; on third hang, quarantine |
| Partial activation | worker emits `ready` but capability projection fails | mark `degraded`; auto-recover on next activation; persistent -> quarantine |
| Worker OOM | host OOM event | restart with reduced `resourceLimits`; persistent -> quarantine |
| Plugin not loadable | bundle missing, dependency missing, Zod parse failed | mark `quarantined`; require operator clearance |

Quarantine trigger policy:

- 3 activation crashes within 5 minutes
- 3 runtime crashes within 5 minutes
- 1 critical security signal (capability denial audit, manifest hash mismatch, etc.)
- operator manual quarantine

## 4. Quarantine trigger and release <!-- oc:id=sec_af -->

Quarantine state attributes:

- `quarantinedAt`: timestamp
- `quarantineReason`: enum + free-form detail
- `crashWindow`: time-bounded count used to trigger

Quarantine release:

- operator-only via `plugins.lifecycle` tool or operator UI
- quarantine is durable in `~/.config/elf/firefly-client/quarantine.json`
- releasing quarantine does NOT clear crash counters; counters decay on a 24-hour TTL after last crash

Once released, plugin re-enters `discovered -> validated -> installed`. If activation crashes again within 5 minutes, quarantine re-applies.

## 5. Manual operator recovery <!-- oc:id=sec_ag -->

- via `plugins.lifecycle` tool:
  - `plugin.<id>.lifecycle.enable`
  - `plugin.<id>.lifecycle.disable`
  - `plugin.<id>.lifecycle.quarantine.clear`
  - `plugin.<id>.lifecycle.history` (last N crashes, with timestamps and reasons)
- via operator UI: same surface, with a per-plugin panel showing live status, last error, crash history, and active grants
- operator can read the audit log via `plugins.permissions` (granted) and audit-log file (full history)

Recovery procedure documented in operator runbook:
1. inspect `plugins.describe` for the plugin <!-- oc:id=item_aa -->
1. inspect `plugins.permissions` for active grants <!-- oc:id=item_ab -->
1. inspect crash history via `plugins.lifecycle.history` <!-- oc:id=item_ac -->
1. if symptom is a known-bad update, roll back via `plugin.<id>.update` with previous version pin <!-- oc:id=item_ad -->
1. clear quarantine via `plugin.<id>.lifecycle.quarantine.clear` <!-- oc:id=item_ae -->
1. monitor `plugins.state` for re-stabilization <!-- oc:id=item_af -->

## 6. Resource-limit notes from precedent research <!-- oc:id=sec_ah -->

- ~10 MB baseline per worker thread (Node.js docs); allow 256 MB heap per plugin for v1
- `SharedArrayBuffer` is supported but discouraged for plugin payloads; host transfers `ArrayBuffer` ownership instead
- `BroadcastChannel` works across workers; host can use it for host -> all-plugins fan-out (theme-changed, app-quit)
- `worker_threads.locks` (Node 22+) is a real `LockManager`; host uses it for broker serialization when needed
- `markAsUntransferable` for buffer pool entries; prevents accidental handoff of shared state
- v8 heap snapshots can be GB-sized for a busy plugin; plan storage and rotation

## 7. Acceptance summary <!-- oc:id=sec_ai -->

- [x] Isolation and supervision cover startup, runtime, crash, hang, and quarantine
- [x] Recovery and operator override path are explicit