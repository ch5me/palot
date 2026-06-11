# Task 29 — Performance, Quotas, and Plugin Metering Plan <!-- oc:id=sec_aa -->

> Wave 5, Task 29 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## 1. Resource limits and quotas <!-- oc:id=sec_ab -->

| Resource | Default | Override | Notes |
|---|---|---|---|
| Plugins installed (per user) | 50 | not in manifest; operator config | first-party plugins counted; VS Code rejected imports don't count |
| Plugins active simultaneously | 16 | per-plugin activation lock | soft cap; supervisor queues activations |
| Per-plugin worker heap | 256 MB (maxOldGenerationSizeMb) | manifest `runtime.limits.heapMb` (proposed tier) | supervisor forces quarantine on OOM |
| Per-plugin worker young gen | 32 MB | manifest `runtime.limits.youngMb` | same as above |
| Per-plugin worker stack | 4 MB | not overridable | hard ceiling |
| Dispatching ceiling (host -> running) | 5 s | per-tool in manifest | state machine -> `timeout` |
| Running ceiling | 60 s | per-tool in manifest | state machine -> `timeout` |
| Hot-reload rate limit | 10 / min per plugin | operator config | burst limit; surplus -> queued or `degraded` |
| Capability prompts per session | 5 / min | operator config | debounce: one summary after threshold |
| Capability prompts per user per day | 50 | operator config | hit limit -> user must explicitly grant in settings |
| Storage per session (Firefly XDG) | 16 MB | not overridable | plugin can request more; operator must approve |
| Storage per project | 64 MB | not overridable | same as above |
| Storage per app | 256 MB | not overridable | same as above |
| Global-profile storage | 1 GB | operator config | not required for V2 initial |
| Audit log rotation | 100 MB per month per plugin | operator config | NDJSON append + rotate |
| Tool calls per session per plugin | 5,000 | not in manifest; host policy | hit limit -> `unavailable` envelope + audit |
| Tool call arguments size | 256 KB | not in manifest | larger args -> `validation_error` |
| Tool result payload size | 1 MB | not in manifest | larger -> `unavailable` |

## 2. AI metering model <!-- oc:id=sec_ac -->

V2 is multi-provider. Each `ai` capability invocation is metered against the calling plugin:

- counter: `firefly-client.broker.<pluginId>.ai.calls.count` per (provider, model)
- counter: `firefly-client.broker.<pluginId>.ai.tokens.input` per (provider, model)
- counter: `firefly-client.broker.<pluginId>.ai.tokens.output` per (provider, model)
- counter: `firefly-client.broker.<pluginId>.ai.cost.usd` per (provider, model)

The host already tracks cost at the OpenCode layer for built-in usage. V2 extends that with per-plugin attribution. Plugin requests are funneled through the host's existing cost-tracking path; we just attach `pluginId` to the attribution record.

Operator UI surfaces a per-plugin AI usage panel:
- last 24h call count
- last 24h token total
- last 24h cost total
- last 7d same
- last 30d same

Plugin authors can also expose a per-plugin usage tool that the agent can call to query its own consumption. The introspection tool returns the same shape as the operator UI panel.

## 3. Per-plugin telemetry <!-- oc:id=sec_ad -->

Namespace: `firefly-client.broker.<pluginId>.*` plus `firefly-client.lifecycle.<pluginId>.*` plus `firefly-client.surface.<pluginId>.<contributionId>.*` per opened surface.

Counters emitted at runtime:

- `firefly-client.broker.<pluginId>.invocation.count`
- `firefly-client.broker.<pluginId>.denied.count`
- `firefly-client.broker.<pluginId>.error.count` per `errorCode`
- `firefly-client.broker.<pluginId>.cancelled.count`
- `firefly-client.broker.<pluginId>.timeout.count`
- `firefly-client.broker.<pluginId>.bytes.accessed` (fs/net)
- `firefly-client.broker.<pluginId>.ai.*` per provider/model
- `firefly-client.lifecycle.<pluginId>.state.transition` event (per transition with from/to/timestamp)
- `firefly-client.lifecycle.<pluginId>.crash.count`
- `firefly-client.lifecycle.<pluginId>.reload.count`
- `firefly-client.lifecycle.<pluginId>.quarantine.count`
- `firefly-client.surface.<pluginId>.<contributionId>.opened.count`
- `firefly-client.surface.<pluginId>.<contributionId>.command.run.count`
- `firefly-client.surface.<pluginId>.<contributionId>.error.count` per `errorCode`

Telemetry storage: per-plugin rollup file `~/.local/share/elf/firefly-client/telemetry/<pluginId>/<yyyy-mm>.ndjson`. Operator UI reads this directly.

## 4. Scaling assumptions <!-- oc:id=sec_ae -->

- 16 active plugins concurrent is the soft cap. Tested on reference hardware: 16 worker threads with 256 MB heap = 4 GB RSS host-side, well within typical dev machines.
- Renderer projection stream emits an event per `plugin.snapshot` plus per dirty surface. Worst case: 50 plugins with all 4 families dirty = 200 events. Re-batched into a single IPC frame.
- Tool projection adds 1-5 tool entries per plugin (introspection + surface wrappers + business tools). 16 plugins * 5 tools = 80 tools total. OpenCode runtime can handle 100+ tools; well within budget.
- Command palette index grows linearly with contributed commands + host-reserved built-ins. 16 plugins * 20 commands = 320 items. Recents + categorization keep palette snappy.
- Theme catalog is small (typically < 100). 16 plugins * 5 themes = 80 themes. Preview path is the only one that allocates per-theme work; preview is host-owned and short-lived.
- Audit log writes are append-only NDJSON. 5,000 calls/session/plugin at 256 bytes each = 1.25 MB / session / plugin. Daily aggregation < 100 MB.
- Telemetry writes are append-only NDJSON. Counters are monotonic. Per-plugin rollup is generated lazily.

## 5. Acceptance summary <!-- oc:id=sec_af -->

- [x] Runtime quotas and metering are explicit
- [x] Per-plugin AI/tool cost attribution is included
- [x] Telemetry namespace locked with concrete counter names
- [x] Scaling assumptions grounded in current repo capability tiers