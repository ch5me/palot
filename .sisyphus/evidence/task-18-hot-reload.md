# Task 18 — Plugin Runtime Hot Reload and Dev Loop <!-- oc:id=sec_aa -->

> Wave 3, Task 18 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## What this means for V2 <!-- oc:id=sec_ab -->

Plugin authors iterate on manifest + handler code continuously. The dev loop must let them edit a file and see renderer UI + OpenCode tool surface reflect the change in seconds, without restarting Electron and without leaking dev-only behavior into production. Hot reload is a **first-class supervisor responsibility** (Task 11), not a `module.hot.accept` hack. The V2 dev loop is the supervised restart of one plugin worker plus a coherent reprojection of all four projections, gated by an explicit unsigned-dev trust path.

## 1. Build / watch pipeline <!-- oc:id=sec_ac -->

### 1.1 Bundle shape <!-- oc:id=sec_aj -->

Every plugin ships as one or more entry files plus a `PluginManifest`. The bundler produces a host-loadable artifact for each `tier`:

- **Built-in** — pre-bundled at host build time, lives in `apps/desktop/src/main/plugins/built-in/<pluginId>/`. Dev reload uses a no-op fast path: rebuild only re-emits the file tree; the supervisor picks it up.
- **Local-dev** — authored under `~/.config/elf/firefly-client/dev/<pluginId>/` or repo path, bundled by the host's dev `vite`/`esbuild` driver that the supervisor owns. Host's dev server emits ESM bundles for renderer-facing surfaces and a separate `worker_thread` bundle for the plugin worker.
- **Signed-third-party** — pre-built by the plugin author, signed, unpacked into `~/.local/share/elf/firefly-client/plugins/<pluginId>/<version>/`. Dev reload does not apply; updates go through install/rollback (Task 6).

### 1.2 Watch sources <!-- oc:id=sec_ak -->

| Source | Watcher | Why |
|---|---|---|
| `apps/desktop/src/main/plugins/built-in/<id>/**` (in repo) | repo `bun run dev` Vite HMR + plugin-supervisor fs watcher | built-in iteration must be coherent with renderer/electron-vite HMR |
| `~/.config/elf/firefly-client/dev/<id>/**` | plugin-supervisor fs watcher (`chokidar`, debounced 200 ms) | local-dev loop runs without repo-wide dev server |
| `~/.local/share/elf/firefly-client/plugins/<id>/<v>/**` | NOT watched (immutable after install) | signed artifacts are pinned versions |
| `apps/desktop/.opencode/plugins/<id>.js` (legacy bridge) | NOT hot-reloaded; restart required | out of V2 scope; covered by Task 20 migration |

Watcher contract:

- Watcher emits `plugin.<id>.sources.dirty` on the supervisor IPC bus.
- Watcher ignores writes to `node_modules/`, `.git/`, `dist/`, `*.map`, `*.lock` inside plugin trees.
- Watcher rate-limits: max 1 reload trigger per plugin per 500 ms (debounce + throttle).

### 1.3 Rebuild steps <!-- oc:id=sec_al -->

1. `discover` — re-walk plugin tree, hash all source files. <!-- oc:id=item_aa -->
1. `validate` — re-parse manifest through the V2 Zod schema (Task 7); abort reload on parse error, log to operator log, leave previous worker running. <!-- oc:id=item_ab -->
1. `compile` — call bundler driver (`vite build --watch` for renderer surfaces, `esbuild --bundle` for worker surface). Output lands in a per-plugin staging dir. <!-- oc:id=item_ac -->
1. `diff` — compute manifest hash + bundle hash; if unchanged, skip reload. <!-- oc:id=item_ad -->
1. `signal` — emit `plugin.<id>.reload.ready` to the supervisor. <!-- oc:id=item_ae -->

Dev-build defaults (overridable per plugin via manifest under `dev` block, see Task 12 `proposed` tier):

- `sourcemap: true`
- `minify: false`
- `target: esnext` (renderer) / `node20` (worker)
- `external: ["firefly-client", "zod"]` — host-provided modules are not rebundled

## 2. Hot reload teardown / restart sequence <!-- oc:id=sec_ad -->

### 2.1 State machine for reload <!-- oc:id=sec_am -->

```
   active
      |
      |  supervisor receives plugin.<id>.reload.ready
      v
   draining
      |
      |  in-flight calls cleared OR grace timeout fires
      v
   tearing-down
      |
      |  worker terminate + MessagePort close
      v
   spawning
      |
      |  worker ready event
      v
   activating (Task 11 path: discovered -> validated -> installed -> activating -> active)
      |
      v
   active (new generation)
```

Side branches:

- `draining` -> `failed` if grace timeout (default 5 s) fires before in-flight calls return; failed reload increments `reloadFailureCount`; on 3 failures within 5 min, supervisor routes the plugin into `degraded` (Task 11 §2), not `quarantined` (reload failures are not crashes).
- `spawning` -> `failed` if worker fails to emit `ready` within 10 s; same as above.
- `tearing-down` -> `failed` if `worker.terminate()` does not complete within 3 s; supervisor escalates to `workerThread.terminate({ force: true })` and logs the force-terminate event.

### 2.2 Teardown order (mandatory) <!-- oc:id=sec_an -->

The supervisor executes these steps in order. Skipping a step is a violation.

1. **Mark draining** — emit `plugin.<id>.lifecycle.draining`. No new tool calls accepted. Renderer shows the "reloading" badge. OpenCode receives a `cancelled`-then-`unavailable` envelope for any in-flight call (Task 9 state machine). <!-- oc:id=item_af -->
1. **Cancel in-flight tool calls** — host sends `cancel` to all `running` / `dispatching` plugin calls for this plugin. They transition to `cancelled` (Task 9 §5). Per-call state preserved on the host side so the agent can retry after re-activation. <!-- oc:id=item_ag -->
1. **Unsubscribe renderer surface from plugin events** — renderer projection receives `plugin.<id>.detach` for every panel, widget, command, theme contributed by this plugin. The placeholder UI from Task 13 §2 takes over. <!-- oc:id=item_ah -->
1. **Close iframe bridges** — if the plugin declared any iframe/webview escape hatch (Task 8), destroy the iframe element and revoke its `src` to prevent postMessage from a dead worker. <!-- oc:id=item_ai -->
1. **Terminate worker** — `worker.postMessage({type: 'shutdown'})` then `worker.terminate()`. Wait up to 3 s. <!-- oc:id=item_aj -->
1. **Close MessagePort** — host disposes the port; the supervisor records the worker generation number (`workerGeneration++`). <!-- oc:id=item_ak -->
1. **Spawn new worker** — host loads the new bundle, instantiates a new `worker_thread`, re-injects the host API facade, awaits `ready`. <!-- oc:id=item_al -->
1. **Re-activate** — execute the Task 11 `activating -> active` path. Re-derive manifest hash, capability grants, projection inputs. <!-- oc:id=item_am -->
1. **Reproject** — see §5 below. <!-- oc:id=item_an -->
1. **Mark active** — emit `plugin.<id>.lifecycle.active` with new `workerGeneration`. Renderer swaps "reloading" badge back to normal. <!-- oc:id=item_ao -->

### 2.3 Reload triggers <!-- oc:id=sec_ao -->

| Trigger | Source | Reload style |
|---|---|---|
| Source file change | supervisor fs watcher | full teardown + restart |
| Manifest change | supervisor fs watcher (manifest watcher) | full teardown + restart (manifest hash is part of `PluginDescriptor`) |
| Capability grant change | operator UI / `plugin.<id>.permissions.revoke` | in-place refresh; no worker restart; projection re-derive only |
| Theme data change | plugin manifest `contributes.themes` (built-in only) | projection re-derive; no worker restart |
| Plugin disable | operator action | worker terminate; no respawn |
| Plugin enable | operator action | `discovered -> active` path; no prior worker |

## 3. State preservation boundaries <!-- oc:id=sec_ae -->

### 3.1 What survives reload <!-- oc:id=sec_ap -->

| State | Scope | Survives reload? | Where stored |
|---|---|---|---|
| Granted capabilities | app | YES | `~/.config/elf/firefly-client/grants.json` (Task 15) |
| User-picked theme | app | YES | `themeAtom` (Task 16) |
| Plugin enable/disable flag | app | YES | `plugins.lifecycle` durable store |
| Quarantine status | app | YES | `quarantine.json` (Task 11 §4) |
| Panel placement (which side, order) | app | YES | `apps/desktop/src/renderer/atoms/session-widgets.ts`-equivalent durable store |
| Per-session widget mount list | session | YES (durable) | session DB (Task 15 §session scope) |
| Operator audit log | app | YES | append-only log file |
| Crash counters | app | YES | durable store, 24h TTL after last crash (Task 11) |

### 3.2 What is destroyed on reload <!-- oc:id=sec_aq -->

| State | Scope | Survives? | Why |
|---|---|---|---|
| Worker-local cache (any `Map` / `Set` held in worker memory) | worker | NO | worker is replaced; intentional clean slate |
| In-flight tool call promises | session | NO (call ends) | agent sees `cancelled` envelope; per-call state on host is retained so retry is possible |
| Open subscriptions to host events from worker | worker | NO | re-registered on `ready` |
| Renderer projection keys for this plugin (e.g., open panel state, scroll position, form inputs) | session | NO | re-derived from projection; placeholder during drain |
| UI animation/transition state | session | NO | intentional, animation restarts cleanly |
| Pending UI hint follow-ups (e.g., `openPanel` queued) | session | NO (dropped) | hint enqueued pre-drain is discarded; agent can re-request |

### 3.3 Session-scoped tool call state machine on reload <!-- oc:id=sec_ar -->

In-flight tool calls during reload follow Task 9's state machine:

- `queued` / `dispatching` -> `cancelled` with `errorCode: reload_pending` and `provenance.reason: plugin_reload`
- `running` -> grace window of 5 s to complete normally; if not done, `cancelled` with `errorCode: reload_grace_expired`
- `timeout` -> `cancelled` immediately

After reload completes, the agent's transport receives a `plugins.lifecycle` event listing any tool calls that were cancelled. The agent can re-issue. The host does NOT auto-retry cancelled calls (would violate least-surprise; agent decides).

### 3.4 Boundary contract <!-- oc:id=sec_as -->

The boundary is **worker-local state vs host-owned state**. Anything durable must live in the host-owned store. The worker has no filesystem or network reach of its own (Task 11 §1); any state that needs to outlive a worker generation must be written through the host API facade. This is the rule that prevents "I lost my session data after a reload" bugs.

## 4. Dev-mode unsigned behavior <!-- oc:id=sec_af -->

### 4.1 Trust tier for dev plugins <!-- oc:id=sec_at -->

Dev plugins default to **`tier: local-dev`** (Task 6). They are unsigned. They are gated as follows:

- Only loadable from `~/.config/elf/firefly-client/dev/<id>/` or repo-relative paths the operator explicitly listed in `devmux`/runtime config (no arbitrary `~/Desktop/foo`).
- Must declare `tier: local-dev` in manifest (or be auto-classified as local-dev if path matches the dev root).
- Capabilities are granted with the operator's existing consent state; new capabilities surface a permission prompt on first activation (Task 10).
- Network/shell capabilities are not relaxed for local-dev; same broker checks as signed plugins. The dev tier is **not a privilege bypass** — it is a **convenience tier** that skips signature verification and allows the watcher-driven restart loop.

### 4.2 What dev-mode does NOT change <!-- oc:id=sec_au -->

- Capability broker still denies by default (Task 10).
- Worker isolation, memory limits, heartbeat, crash counters, quarantine all still apply (Task 11).
- OpenCode projection still requires Zod schema; missing/invalid schema = worker rejected, no fallback.
- Renderer projection still flows through the host reconciler; dev plugin can NOT mount arbitrary DOM.
- No `eval`, no dynamic `require` in worker bundle (built with `esbuild --bundle` and no `define:process.env.NODE_ENV=development` magic that opens eval).
- Bundle is still subject to the same V2 schema negotiation (Task 12); apiVersion pin still enforced.

### 4.3 What dev-mode DOES change <!-- oc:id=sec_av -->

| Behavior | Production (signed) | Dev (local-dev) |
|---|---|---|
| Signature verification | required | skipped |
| Watcher-driven reload | off | on |
| Sourcemaps in worker bundle | off | on |
| `console.*` from worker | piped to operator log only | mirrored to devtools + operator log |
| Stack traces on error | redacted | full |
| Reload grace window | 5 s (production) | 5 s (same) — no slop |
| Reload failure tolerance | 3 in 5 min -> degraded | 3 in 5 min -> degraded (same) |
| Crash counter TTL | 24 h | 24 h (same) |
| Operator prompt for new capabilities | required | required (same) |
| Theme application | precedence 1 wins (Task 16) | precedence 1 wins (same) — user pick is never overridden by dev theme |

### 4.4 Dev mode enablement <!-- oc:id=sec_aw -->

- Default: dev mode is **off**. The host must be started with `--firefly-dev-plugins` (or `devPlugins: true` in the operator runtime config) to opt in.
- Opt-in is sticky per host session; not persisted.
- When dev mode is off, the supervisor refuses to load any plugin from the dev root, even if the operator manually edited the config to point at it. This is enforced in the supervisor's `loadOrThrow` path, not just in the UI.
- Dev mode is logged loudly on startup so the operator cannot forget it is on.

## 5. Renderer + OpenCode projection refresh <!-- oc:id=sec_ag -->

### 5.1 Why this must be coherent <!-- oc:id=sec_ax -->

The renderer sees panels, widgets, commands, themes. OpenCode sees tool definitions, introspection, and system-context blocks. Both are derived from the same `PluginDescriptor` + `PluginInstance` + `PluginSessionHandle` (plan §"Source Of Truth Model"). If they refresh out of order, the user sees a new panel whose tool does not yet exist (call -> `unavailable` + `errorCode: plugin_reload_pending`) or, worse, the agent calls a stale tool whose panel was already removed (call -> `failed` + `errorCode: tool_not_projected`).

### 5.2 Coherent refresh sequence <!-- oc:id=sec_ay -->

The supervisor runs these steps atomically from the renderer's and OpenCode's perspective. The host batches all four projection updates into a single `plugin.<id>.projection.refresh` event.

1. **Build the new `PluginDescriptor`** from the re-validated manifest. Old descriptor is held in memory until step 5. <!-- oc:id=item_ap -->
1. **Build the new `PluginSessionHandle`**. The session DB is read fresh; per-session state is unchanged. <!-- oc:id=item_aq -->
1. **Compute the diff**: <!-- oc:id=item_ar -->
   - added contributions (panels, widgets, commands, themes, tools)
   - removed contributions
   - changed contributions (capability set changed, schema version changed, etc.)
1. **Stage the new projections** in a frozen `pendingProjections` object. Do not publish yet. <!-- oc:id=item_as -->
1. **Atomically swap the canonical state**: <!-- oc:id=item_at -->
   - The host's `PluginInstance` flips its `activeDescriptor` reference from old to new.
   - The `PluginSessionHandle` flips its `projectedTools` reference.
   - This is a single reference replacement in main; renderer and OpenCode consumers read the same references.
1. **Publish the refresh event** to all subscribers in this order: <!-- oc:id=item_au -->
   1. **OpenCode bridge first** — emit the new tool definitions and updated system-context blocks. The SDK receives `tools/list` and `tools/refresh` simultaneously. In-flight calls already routed to the old generation will be cancelled before this point. <!-- oc:id=item_av -->
   1. **Renderer second** — emit `plugin.<id>.projection.refresh` with the full new projection payload (added/removed/changed contributions). Renderer's Jotai atoms re-derive from the new projection; React re-renders the new UI tree. <!-- oc:id=item_aw -->
   1. **Audit/log third** — append to operator log and to `plugins.lifecycle` audit. <!-- oc:id=item_ax -->
1. **After successful publish**, discard the old descriptor and old worker generation handle. <!-- oc:id=item_ay -->

The order matters: OpenCode must see the new tool surface *before* the renderer mounts the new panel that advertises that tool. If the order were reversed, the renderer could show a panel with a "Run" button that calls a tool OpenCode does not yet have.

### 5.3 Failure handling during refresh <!-- oc:id=sec_az -->

| Failure | Behavior |
|---|---|
| OpenCode transport rejects the new tool list | abort refresh; revert to old descriptor; render an error toast in renderer ("Plugin reload failed: tool projection rejected"); worker stays at new generation but projections stay old until operator clears. Worker is not rolled back because the new code may have side effects already executed. |
| Renderer projection build fails (Zod parse of new manifest data) | abort refresh; same revert as above |
| OpenCode and renderer both reject | same revert; no half-applied state |
| Refresh event publish partially succeeds (OpenCode yes, renderer no) | log inconsistency; operator UI surfaces it; both consumers read the new descriptor on next read because reference was already swapped. Renderer is expected to re-derive on its next poll. This is the only path where a transient inconsistency is possible, and it self-heals within one render tick. |

### 5.4 Coherence test surface <!-- oc:id=sec_ba -->

For verification (Task 28 gates), the dev loop must support a `--firefly-dev-reload-smoke` mode that:

1. Spawns a sandboxed dev plugin <!-- oc:id=item_az -->
1. Forces a reload via manifest edit <!-- oc:id=item_ba -->
1. Asserts that for each added/removed/changed contribution, the OpenCode tool list and the renderer registry both update before the test returns <!-- oc:id=item_bb -->
1. Times out at 5 s; on timeout, prints the diff between what OpenCode knows and what renderer knows <!-- oc:id=item_bc -->

## 6. Edit -> rebuild -> restart -> reprojection loop (explicit) <!-- oc:id=sec_ah -->

End-to-end happy path:

| # | Actor | Action | Result |
|---|---|---|---|
| 1 | Author | saves `src/panel.tsx` and `manifest.json` | fs watcher debounce starts |
| 2 | Watcher | emits `plugin.<id>.sources.dirty` after 200 ms | supervisor picks up |
| 3 | Supervisor | re-validates manifest through Zod | ok or abort |
| 4 | Supervisor | calls bundler driver; produces new worker bundle + new renderer bundle | `dist/<id>/worker.js`, `dist/<id>/renderer.js` |
| 5 | Supervisor | hashes old vs new bundle; equal => skip | step skipped if no diff |
| 6 | Supervisor | emits `plugin.<id>.lifecycle.draining` | renderer shows "reloading" badge; OpenCode stops accepting new calls for this plugin |
| 7 | Supervisor | cancels in-flight tool calls (Task 9 state machine) | agent sees `cancelled` envelopes |
| 8 | Supervisor | unsubscribes renderer projections (Task 13) | placeholder UI |
| 9 | Supervisor | closes iframe bridges if any | clean DOM |
| 10 | Supervisor | `worker.terminate()`; closes MessagePort | worker dead |
| 11 | Supervisor | spawns new worker with new bundle; awaits `ready` | new worker alive |
| 12 | Supervisor | runs Task 11 `activating -> active` path | ok or degraded |
| 13 | Supervisor | builds new `PluginDescriptor` and `PluginSessionHandle` | new state ready |
| 14 | Supervisor | atomically swaps canonical state (single reference) | both consumers see the new state |
| 15 | Supervisor | publishes to OpenCode (tools + system-context) | new tool list live |
| 16 | Supervisor | publishes to renderer (panels + widgets + commands + themes) | new UI live |
| 17 | Supervisor | publishes audit event | logged |
| 18 | Author | sees the change in the running app | full cycle complete |

Default timing budgets:

- Steps 1-2: 200 ms (debounce)
- Steps 3-5: 50 ms (validation + bundle + hash)
- Steps 6-10: 5 s grace ceiling (in-flight) + 3 s (terminate)
- Steps 11-12: 10 s ceiling (ready wait)
- Steps 13-17: 50 ms (in-memory atomic swap)
- Total: 200 ms + 50 ms + 8 s + 10 s + 50 ms ceiling, real-world typically < 1 s for small plugins

## 7. Acceptance summary <!-- oc:id=sec_ai -->

- [x] Edit -> rebuild -> restart -> reprojection loop is explicit (§6 row-by-row table)
- [x] Renderer and OpenCode projections refresh coherently (§5 atomic swap, ordered publish, failure revert)
- [x] Hot reload is process-level (worker restart), not module cache hack (Must NOT do satisfied)
- [x] Dev-mode unsigned behavior is bounded, not a privilege bypass (§4)
- [x] State preservation boundaries are explicit and call out session-scoped tool call handling (§3)