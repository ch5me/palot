# Firefly Extension Marketplace — Design (V2)

Status: **DRAFT for review** · Owner: desktop/firefly-plugin · Last updated: 2026-06-16

Design the Palot / Firefly plugin system toward a VS Code-like extension model
**without cloning VS Code's runtime** or coupling extensions to renderer internals.
A native Firefly extension system with a VS Code-shaped package/import adapter.

This revision folds in three decisions:

- **Backend = firefly-cloud.** The gallery/registry is an API built into firefly-cloud
  (our existing app backend), not a standalone service. firefly-cloud is also the
  **host authority for the web build** (see §2).
- **Identity = Open VSX-style `namespace.name`** as the long-term canonical key
  (companies publish under their namespace) — see §4.
- **Web *and* Electron are first-class targets.** Where extensions run is defined up
  front in §2, not bolted on later.

---

## 1. Design stance

Do not implement "VS Code compatibility" as a runtime promise. Implement a native
Firefly extension system with a VS Code-shaped package/import adapter.

Rules (load-bearing — every later section obeys these):

- **Manifest is source of truth.** Runtime state never mutates the package manifest.
- **Renderer never loads extension code.** Renderer consumes host projections only.
- **Extension host talks to the host authority over typed RPC.** The host authority
  owns capability checks.
- **Marketplace install writes immutable package bytes + mutable install records.**
- **VS Code / Open VSX import starts data-only** (themes, snippets, icon themes,
  language metadata). Runtime extensions are classified before conversion.
- **No silent fallback.** Unsupported API / unsupported surface ⇒ rejected import or
  explicit degraded contribution — never a quiet no-op (CH5 fail-fast).

---

## 2. Execution surfaces: Web vs Electron (read this first)

Palot ships **two builds** from one codebase, exactly like VS Code (desktop) and
VS Code for the Web (vscode.dev):

| Build | "Main process" / host authority | Code-running runtimes available | Filesystem / shell / Node |
|---|---|---|---|
| **electron** (desktop) | Electron **main process** (Node), with firefly-cloud for the gallery | local: utility process, worker thread, web worker, iframe | yes (local) |
| **web** (browser) | **firefly-cloud** (Node, remote) + a thin in-renderer projection consumer | browser: web worker, iframe; Node runtimes only **remotely** via firefly-cloud | no local Node/fs/shell; only via firefly-cloud |

### 2.1 The core idea

> **Host kind declares the runtime *contract*. The build + environment decides the
> *location* that fulfills that contract.**

A `node-worker` extension needs Node — but *where* Node lives differs: in Electron
it's a local utility process; in the web build it's firefly-cloud (remote), exactly
like VS Code Codespaces runs the workspace extension host remotely. The extension
doesn't change; the host resolves a **runtime location** for it.

### 2.2 Runtime locations

```ts
type RuntimeLocation =
  | "none"             // data-only: no code runs; host projects the manifest
  | "electron-main"    // host-owned built-in code in the Electron main process
  | "electron-utility" // Node utility process / worker thread (Electron only)
  | "browser-worker"   // Web Worker in the renderer (both builds)
  | "cloud-host"        // Node extension host inside firefly-cloud (remote RPC)
  | "iframe"           // sandboxed iframe UI (both builds)
```

### 2.3 Host kind → location, per build (the matrix)

| Host kind | Contract | Electron build | Web build |
|---|---|---|---|
| `data-only` | declarative, no code | `none` (projected by main) | `none` (projected by firefly-cloud) |
| `builtin-main` | host-owned code | `electron-main` | `cloud-host` (or web-safe port) |
| `node-worker` | needs Node/workspace APIs | `electron-utility` (local) | `cloud-host` (remote) — **never in the browser** |
| `web-worker` | browser-safe only | `browser-worker` | `browser-worker` |
| `iframe-view` | UI only, sandboxed | `iframe` | `iframe` |

Consequences, stated explicitly (no silent fallback):

- `web-worker` / `iframe-view` / `data-only` extensions run identically in both
  builds — these are the **portable tier** and the **target shape for third parties**.
- **DECIDED (2026-06-16): web V2 ships the portable tier only.** In the web build,
  `node-worker` extensions show **"unsupported on this surface"** until the
  firefly-cloud `cloud-host` lands (Phase 3); they are never silently disabled. Electron
  supports all tiers locally from Phase 0.
- The renderer never hosts extension code in *either* build. UI contributions are
  either host-reconciled declarative projections or sandboxed iframes.

### 2.4 Host authority is an interface with two implementations

The host authority owns: catalog assembly, capability checks, lifecycle/supervision,
install/registry writes, and the extension-host RPC. It is a **single contract** with
two backends so the rest of the system is build-agnostic:

```ts
interface HostAuthority {
  catalog(): CatalogProjection
  resolveCapability(req: CapabilityRequest): CapabilityDecision
  install(spec: InstallSpec): Promise<InstallResult>
  activate(pluginId: PluginId, event: ActivationEvent): Promise<RuntimeInstance>
  // … lifecycle, projections, storage
}
```

- **Electron** → `ElectronHostAuthority` in the main process (today's
  `main/firefly-plugin/*`). Local lifecycle; talks to firefly-cloud for the gallery.
- **Web** → `CloudHostAuthority` backed by firefly-cloud over WebSocket/HTTP RPC.
  All trust/secret/fs-bearing operations resolve server-side.

The renderer (identical in both builds) consumes projections + issues RPC against
whichever authority is wired in. This is the cleanest seam in the design: it makes
firefly-cloud "the main process for the web," and keeps one renderer.

### 2.5 Manifest declares supported surfaces

```jsonc
{
  "runtime": {
    "hostKind": "node-worker",
    "surfaces": ["electron", "web"],   // which builds this version supports
    "webStrategy": "cloud-host"        // node-worker in web: "cloud-host" | "unsupported"
  }
}
```

The host resolves `RuntimeLocation` from `hostKind` + current build + `webStrategy` +
workspace policy. Compatibility solving (§5) rejects/degrades when no location exists
for the current surface.

---

## 3. Host architecture

Pipeline (source → projection), authority-agnostic:

```text
marketplace source / local vsix
  -> package resolver
  -> signature + checksum verifier
  -> manifest parser
  -> manifest converter (native or VS Code -> Firefly V2 descriptor)
  -> compatibility solver        (host compat + surface/location resolution)
  -> catalog descriptor
  -> projections
      -> renderer UI projection
      -> command palette projection
      -> agent tool projection
      -> theme projection

activation request
  -> lifecycle supervisor
  -> capability broker            (host authority owns the decision)
  -> extension host RPC           (location per §2.3)
  -> host service / storage / workspace API
```

Host kinds (with isolation and where they run — see §2.3 for per-build location):

| Host kind | Runs code? | Use for | Isolation |
|---|---|---|---|
| `data-only` | no | themes, snippets, language config, icon themes | manifest validation only |
| `builtin-main` | yes, host-owned | Palot built-ins during migration | main / cloud handlers |
| `node-worker` | yes | trusted/signed extensions needing Node/workspace APIs | utility process or cloud-host |
| `web-worker` | yes | browser-safe extensions (portable tier) | worker, no Node |
| `iframe-view` | yes, UI only | webviews / remote UI panels | sandboxed iframe + explicit message bridge |

**Process grouping:** prefer **one process per trust/runtime group**, not one per
extension. Crash policy can quarantine a single extension while restarting the host
group, provided state maps `pluginId -> activation context`. (In the web build, the
group runs in firefly-cloud; quarantine is server-side per workspace.)

---

## 4. Identity & namespacing (long-term)

Adopt the **Open VSX model**: canonical identity is `namespace.name`.

- `namespace` = the publishing org (a company, a person, or `firefly` for built-ins).
  Domain-verified for third parties (like VS Code publisher verification). Reserved:
  `firefly`, `palot`, `ch5`.
- `name` = unique within the namespace.
- Internal `pluginId` string = `` `${namespace}.${name}` `` — structurally the same
  dotted string the codebase already uses as the join key, so stores/IPC/catalog keep
  working.

**Migration — DECIDED (2026-06-16): migrate now, with aliases.** Built-ins move from
reverse-DNS (`firefly.built-in.surface.memory`) to `namespace.name` (`firefly.memory`,
`firefly.notes`, …), **keeping the old id as a back-compat alias** in the catalog during
migration (alias map → canonical). The `pluginIdSchema` is widened to `namespace.name`
with the namespace/name split validated separately. Define the API properly before
users exist — alias the built-ins now, drop aliases after the surface migration settles.

> Rationale: third-party companies publishing under their own verified namespace is
> the explicit future. `namespace.name` is what Open VSX/VS Code use and what the
> marketplace data models below already assume (`namespace` + `name` fields).

---

## 5. Compatibility model

Three independent layers (do not conflate):

### 5.1 Package SemVer

```ts
type ExtensionVersion = `${number}.${number}.${number}${string}`  // full SemVer, prerelease allowed
```

Store the exact published version immutably. Never mutate it for local install state.
Versions are immutable once published (re-publish of `namespace.name@version`
rejected).

### 5.2 Host compatibility (native)

```jsonc
{
  "engines": { "firefly": ">=0.12.0 <1.0.0" },
  "apiVersion": "firefly.plugin/v2",
  "manifestRevision": 1
}
```

Rename today's `engines.desktop` → **`engines.firefly`** (it describes API
compatibility, not one runtime); keep `engines.desktop` as a **migration alias** until
all built-ins update. Acceptance rules:

- Reject when `apiVersion` major is unsupported.
- Reject when `manifestRevision` exceeds host max.
- Reject when host app SemVer does not satisfy `engines.firefly`.
- Reject when **no runtime location exists for the current surface** (§2.3) — e.g. a
  `node-worker`/`webStrategy:"unsupported"` extension in the web build.
- Warn on proposed-API tier; reject third-party use of internal-API tier.
- The **client** picks the newest version that satisfies all of the above (VS Code's
  model — old hosts still resolve an older compatible version).

### 5.3 VS Code import compatibility

`engines.vscode` is **importer input, not a Firefly claim**:

```ts
interface VscodeCompatibilityProbe {
  vscodeEngineRange: string
  extensionKind: Array<"ui" | "workspace" | "web">
  activationEvents: string[]
  contributionPoints: string[]
  apiUsage: string[]
  nativeDependencyRisk: "none" | "optional" | "required"
}
```

Classify with the existing `green | yellow | orange | red` import tiers. Note
`extensionKind` maps to our surface model: `web` → portable (web-worker), `workspace`
→ Node (electron-utility / cloud-host), `ui` → renderer-adjacent (iframe/declarative).

---

## 6. Native extension types (contribution families)

`PluginManifest.contributes` grows by **contribution family**, not by "plugin type".
One plugin may contribute many families. Category is search metadata, **never**
behavior — behavior is `family + capability request + hostKind`.

| Family | VS Code analogue | Firefly projection | Surfaces | Priority |
|---|---|---|---|---|
| `themes` | `contributes.themes` | CSS token map + editor token map | both | P0 |
| `commands` | `contributes.commands` | command palette, menus, keybindings | both | P0 |
| `panels` | views / webviews | side panel / main pane projection | both (iframe/declarative) | P0 |
| `widgets` | custom view-ish | session-scoped widget zones | both | P0 |
| `tools` | (no exact analogue) | agent-callable tools | both (location per hostKind) | P0 |
| `configuration` | `contributes.configuration` | settings schema + defaults | both | P1 |
| `languages` | `contributes.languages` | language metadata, globs, icons | both | P1 |
| `grammars` | `contributes.grammars` | TextMate grammar registration (Monaco) | both | P1 |
| `snippets` | `contributes.snippets` | editor completion snippets | both | P1 |
| `iconThemes` | `contributes.iconThemes` | product/file icon resolver | both | P2 |
| `debuggers` | `contributes.debuggers` | explicit reject or native debug-adapter contract | electron | P3 |

The P0/P1 data-and-UI families are surface-portable (run in both builds). Families
that imply Node (debug adapters, some language servers) are electron / cloud-host only.

---

## 7. Marketplace model

**Registries are pluggable**, with Open VSX and firefly-cloud both first-class.
firefly-cloud is the `firefly` registry kind *and* the web host authority (§2).

```ts
interface RegistrySource {
  id: string
  kind: "open-vsx" | "firefly" | "local-folder" | "local-vsix"
  baseUrl: string | null
  enabled: boolean
  trustPolicy: "builtin" | "verified-only" | "allow-unsigned-with-consent"
  lastSyncAt: string | null
}
```

Default sources: `firefly` (firefly-cloud, our curated/first-party + partner plugins),
`open-vsx` (data-only imports first). **Visual Studio Marketplace is not a default**
(licensing/access); support manual VSIX import and an optional "VS Code Marketplace
URL → try Open VSX equivalent → else manual VSIX" flow.

Each registry kind has an **adapter** behind one `RegistryClient` interface
(query / describe / version / asset / updates). Open VSX uses its v3 API; firefly uses
firefly-cloud's plugin API; local-folder/local-vsix are filesystem adapters. The rest
of the client only knows `RegistryClient` — adding a registry is one adapter.

Data models (canonical):

```ts
interface MarketplaceExtension {
  registryId: string
  namespace: string; name: string
  displayName: string; description: string
  categories: string[]; tags: string[]
  latestVersion: string
  verified: boolean; deprecated: boolean
  downloadCount: number | null; rating: number | null
  iconUrl: string | null; homepageUrl: string | null; repositoryUrl: string | null
}

interface MarketplaceVersion {
  registryId: string
  namespace: string; name: string; version: string
  targetPlatform: "universal" | "web" | "darwin-arm64" | "darwin-x64" | "linux-x64" | "win32-x64"
  engines: Record<string, string>
  extensionKind: Array<"ui" | "workspace" | "web">
  categories: string[]
  files: { manifest?: string; readme?: string; license?: string; download: string; sha256?: string; signature?: string; icon?: string }
  publishedAt: string
  preRelease: boolean
  rawMetadataHash: string
}
```

### 7.1 State storage — app database, not JSON

Per-scope queries (app / profile / workspace) matter, so install/package/grant/runtime
state lives in the **app database (SQLite rows)**, not loose JSON. (This supersedes a
VS Code-style `installed.json`.) Marketplace cache = SQLite rows keyed by
`rawMetadataHash`. Package **bytes** are content-addressed on disk (§8).

```ts
interface ExtensionPackage {          // immutable bytes + provenance
  packageId: string; source: "registry" | "local-vsix" | "local-folder"
  registryId: string | null; namespace: string; name: string; version: string
  targetPlatform: string; contentSha256: string
  vsixPath: string | null; unpackedPath: string; manifestPath: string
  signatureState: "verified" | "missing" | "failed" | "not-applicable"
  scanState: "pending" | "passed" | "failed" | "quarantined"
  createdAt: string
}

interface ExtensionInstallation {     // mutable install record
  installationId: string; pluginId: string; packageId: string
  scope: "app" | "profile" | "workspace"; workspaceId: string | null
  enabled: boolean; pinnedVersion: string | null
  updatePolicy: "manual" | "patch" | "minor" | "latest"
  trustTier: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
  lifecycleState: "installed" | "disabled" | "activating" | "active" | "reload-required" | "quarantined" | "uninstalling" | "removed"
  installedAt: string; updatedAt: string
}

interface ExtensionCapabilityGrant {
  pluginId: string; scope: "app" | "workspace" | "session"; scopeId: string | null
  capability: string
  grantState: "granted" | "denied" | "prompt-required"
  grantedBy: "builtin-policy" | "user" | "admin-policy"
  reason: string; createdAt: string; expiresAt: string | null
}

interface ExtensionRuntimeInstance {
  runtimeId: string; pluginId: string
  hostKind: "data-only" | "builtin-main" | "node-worker" | "web-worker" | "iframe-view"
  runtimeLocation: RuntimeLocation        // resolved per §2.3
  pid: number | null; activationEvent: string
  state: "starting" | "ready" | "stopping" | "crashed" | "quarantined"
  lastHeartbeatAt: string | null; crashCountWindow: number; startedAt: string
}
```

> `trustTier` lives on the **installation** (mutable, derived from verification at
> install time), `signatureState`/`scanState` live on the **package** (immutable
> provenance). Today's `trust` is declarative-only; here it is **derived from
> verification** — the gap closes.

---

## 8. Install / uninstall / hot-reload lifecycle

**Install:**

1. Resolve source + version (registry adapter or local).
2. Download VSIX / read local folder.
3. **Verify checksum + signature** when available (integrity mismatch ⇒ hard fail).
4. Unpack to content-addressed package store.
5. Parse package manifest.
6. Convert native / VS Code manifest → Firefly V2 descriptor.
7. Solve host compatibility **+ resolve runtime location for the surface** (§2.3).
8. Classify trust + raise capability prompts (broker computes risk).
9. Write immutable `ExtensionPackage`.
10. Write mutable `ExtensionInstallation`.
11. Project catalog.
12. **Activate only on activation event** — install ≠ activate.

**Uninstall:**

1. Disable installation → 2. stop runtime instance → 3. remove projections →
4. leave package bytes until no installation references them → 5. GC unreferenced
packages later → 6. preserve user settings/state behind an explicit "remove data".

**Hot-reload** (reuse the existing FSM — `HOT_RELOAD_KIND_POLICY` /
`planHotReloadCycle`; module-cache hacks already rejected):

| Change | Policy | Effect |
|---|---|---|
| enable / disable | `project` | live reproject; supervisor enable/disable + renderer unmount/remount — **no restart** |
| theme-only change | `soft`/`project` | reproject theme + republish projections |
| worker/extension code change | `restart` | restart the host **process/group** (no module-cache invalidation) |
| manifest / contribution change | `restart` / `project` | per policy |
| install / update / uninstall | `restart` cycle (scoped) | tear down → rebuild descriptor → reproject → republish |

**All projection outputs publish together** — renderer, command, agent-tool, theme —
so no surface sees a half-applied reload. Full app/window reload is the **fallback**
only when a scoped cycle reports `failed`, surfaced as `reload-required` (named, never
silent). In the web build, "restart the host group" = restart the firefly-cloud
extension-host worker for that workspace.

**Three layered state machines** (don't conflate): **install state**
(`ExtensionInstallation.lifecycleState`) → **runtime state**
(`ExtensionRuntimeInstance.state`, the worker supervisor) → **UI availability**
(projection). Quarantine + reload-required are orthogonal.

---

## 9. VS Code theme import (first import slice)

VS Code theme package → convert to a normal V2 `themes` contribution
(`imports.source = "open-vsx" | "vscode-theme"`). Two layers:

```ts
interface ImportedThemeContribution {
  id: string; label: string; kind: "light" | "dark" | "high-contrast"
  source: { registry: "open-vsx" | "manual-vsix"; externalId: string; version: string; themePath: string; contentSha256: string }
  appTokens: Record<string, string>                       // mapped → app CSS vars
  editorTokens: {
    vscodeColors: Record<string, string>                  // unmapped ids preserved verbatim
    textMateTokenColors: unknown[]                         // → Monaco/TextMate token theme
    semanticTokenColors: Record<string, unknown>          // → Monaco semantic token theme
  }
  unsupportedColorIds: string[]
}
```

Conversion policy:

- `colors` → app CSS variables via an explicit mapping table (below); unmapped ids
  preserved in `editorTokens.vscodeColors`.
- `tokenColors` → Monaco/TextMate token theme (editor only, **not** app chrome).
- `semanticTokenColors` → Monaco semantic token theme.
- `uiTheme`: `vs` → light, `vs-dark` → dark, `hc-black`/`hc-light` → high-contrast.
- **Preview never mutates the applied theme.**

Initial color map (extend over time):

| VS Code color id | Firefly token | | VS Code color id | Firefly token |
|---|---|---|---|---|
| `editor.background` | `--ff-editor-bg` | | `tab.activeBackground` | `--ff-tab-active-bg` |
| `editor.foreground` | `--ff-editor-fg` | | `tab.inactiveBackground` | `--ff-tab-inactive-bg` |
| `sideBar.background` | `--ff-sidebar-bg` | | `button.background` | `--ff-button-bg` |
| `sideBar.foreground` | `--ff-sidebar-fg` | | `button.foreground` | `--ff-button-fg` |
| `activityBar.background` | `--ff-activity-bg` | | `input.background` | `--ff-input-bg` |
| `activityBar.foreground` | `--ff-activity-fg` | | `input.foreground` | `--ff-input-fg` |
| `statusBar.background` | `--ff-status-bg` | | `focusBorder` | `--ff-focus-ring` |
| `statusBar.foreground` | `--ff-status-fg` | | `selection.background` | `--ff-selection-bg` |
| `panel.background` | `--ff-panel-bg` | | `panel.border` | `--ff-panel-border` |

V1 importer supports only themes where: manifest has `contributes.themes`; theme file
is JSON (not only `.tmTheme`); no activation code needed; license present + displayable;
checksum storable. Themes are `data-only` → run identically in **both** builds.

---

## 10. Trust, signing, capability consent

- **Verify before extract.** Repository signature (registry-signed bytes) gates
  install; publisher signature drives the verified badge. Integrity mismatch on load ⇒
  quarantine + named reason; never run unverified bytes.
- **`trustTier` is derived** from verification at install (not self-declared):
  verified+publisher → `signed-third-party`; verified-only → `signed-third-party` (no
  badge); unsigned marketplace install → blocked unless registry `trustPolicy`
  allows-unsigned-with-consent; dev folder → `local-dev` (dev builds only); compiled →
  `built-in`.
- **Capability consent on install** via the existing broker (deny-by-default, risk
  tiers): prompt for medium/high-risk capabilities, auto-grant low-risk by trust tier;
  grants persist as `ExtensionCapabilityGrant` per scope. In the web build the broker
  runs in firefly-cloud; in Electron, the main process — same contract.

---

## 11. UX model

Marketplace UI surfaces:

- **source**: Open VSX / Firefly / local
- **trust**: verified / signed / unsigned / local-dev
- **compatibility**: compatible / needs-consent / **unsupported on this surface**
  (web-vs-electron is explicit here)
- **contribution families**: theme, command, panel, tool, language, grammar, …
- **requested capabilities**, grouped by risk
- **install scope**: app / profile / workspace
- **lifecycle**: active / disabled / reload-required / quarantined

**"Install" is not "activate."** Install writes bytes + metadata; activation happens
when a declared activation event fires.

---

## 12. Boundary map (what each layer owns)

| Layer | Owns | Must NOT know |
|---|---|---|
| **firefly-cloud gallery API** | registry index, search, stats, FPK/VSIX bytes, repo-signing, publish auth | desktop install paths, local runtime |
| **firefly-cloud host authority** (web build) | server-side catalog, capability checks, cloud-host extension runtime, storage | renderer internals |
| **Electron main host authority** | local catalog, capability checks, local lifecycle, installer, local extension hosts | transport/registry byte source, React |
| **RegistryClient adapters** | per-registry HTTP/FS (open-vsx, firefly, local) | install side-effects, runtime |
| **installer / updater** | download, verify, extract, DB writes, dep graph, drive hot-reload | HTTP shape, React |
| **catalog / projections** | merge sources + overlay → renderer/command/tool/theme projections | how bytes arrived, transport |
| **lifecycle supervisor** | runtime state machine + crash/quarantine | gallery, install location |
| **renderer (both builds)** | consume projections, issue RPC, render | main internals, fs, extension code |

The **`HostAuthority` interface (§2.4)** is the seam that makes the renderer and the
whole catalog/install/projection stack build-agnostic; Electron-main and firefly-cloud
are interchangeable implementations.

---

## 13. Failure / repair plan

- Download/verify fails → install aborts, nothing extracted, typed error (fail-loud).
- Integrity mismatch on load → quarantine + named reason; never run.
- Hot-reload cycle `failed` → `reload-required` (named); offer restart; never run stale
  projection (anti-S8 reflexive fallback).
- Unreferenced package GC fails → logged, retried, bounded + surfaced (anti-S9).
- Registry unreachable → installed extensions keep working from local DB; query/update
  UI shows offline; no silent fallback to a wrong catalog.
- **Surface mismatch** (e.g. node-worker in web with no cloud-host) → explicit
  "unsupported on this surface", never a silent disable.
- Repair = `reinstall`: re-download + re-verify the pinned version, keep enable state.

Each failure repairs at one node (one version folder, one DB row, one plugin's
projection), not the whole catalog.

---

## 14. Implementation plan

**Phase 0 — runtime lifecycle (already approved, local-only).** Build the hot-reload
executor; wire `setEnabled` → supervisor teardown/restart + renderer unmount/remount;
dev file-watcher hot-reload. Closes "disable does nothing." No remote, no gallery.
*Also lands the `HostAuthority` seam (Electron impl first) so later phases are
build-agnostic.*

**Phase 1 — theme marketplace slice (data-only, both builds).** Open VSX search client
(query/category/theme); package store + install/package DB tables; VSIX
download/unpack/manifest parser; `contributes.themes` → V2 theme contribution; theme
preview/apply on the existing pipeline; local VSIX import for themes. Themes are
`data-only` → validates the web/electron portability end to end.

**Phase 2 — data-only VS Code imports.** snippets, language metadata, grammars, icon
themes; contribution-family schemas in the native manifest; Monaco registration
projection.

**Phase 3 — native runtime extensions. ✅ LANDED** (`9b50be1af` contracts +
`0cd976385` runtime). Extension-host RPC protocol (`extension-host-protocol.ts`) +
`RuntimeTransport`; the §2.3 host-kind→location matrix as one SoT
(`runtime-location.ts`) with a manifest `runtime` block; `node-worker` →
electron-utility transport (`utility-process-spawner.ts`, selected in
supervisor-boot); per-call capability grants through dispatch (deny-by-default
resolver + `grant-store.ts` + `install-consent.ts`, replacing the hardcoded
over-grant); extension storage API (`plugin-storage-service.ts`: scoped KV + quota +
safeStorage secrets); `CloudHostAuthority` now a real fail-fast RPC client
(`cloud-host-rpc-client.ts`). *Last-mile (deferred, gated on a live
capability-bearing/code extension — none ship yet): worker storage/grant RPC routing
through the supervisor loop; install-orchestrator grant persistence + consent UI
(themes carry no capabilities). The firefly-cloud RPC **server** is cross-repo.*

**Phase 4 — constrained VS Code runtime import.** Importer for green-tier
command/config/language extensions; `vscode.d.ts` as **compile-time** semantic input
only; reject unsupported APIs at import; **never ship a hidden VS Code sidecar.**

Each phase is independently shippable; state machines + contracts unit-test without a
live gallery.

---

## 15. Decisions & open questions

**Decided (2026-06-16):**

- **Backend** = firefly-cloud API (also the web-build host authority, §2.4).
- **Identity** = `namespace.name` (Open VSX), migrate built-ins now with aliases (§4).
- **Web V2 scope** = portable tier only (data-only + web-worker + iframe);
  `node-worker`-in-web via `cloud-host` deferred to Phase 3 (§2.3).

**Open:**

- **`engines.firefly` rename** (§5.2): land the rename + `engines.desktop` alias now?
- **Package store path** (§8): `~/.local/share/elf/extensions/packages/<sha256>/`
  (XDG) — confirm + the web-build equivalent (firefly-cloud object storage).
- **firefly-cloud gallery contract**: clean REST (recommended) vs Open VSX-compatible
  query surface vs both; confirm where the gallery API lives in firefly-cloud and the
  Hush target for publish auth.
- **Open VSX default-on**: ship with Open VSX enabled for theme/data imports at launch,
  or Firefly-registry-only until curation policy is set?
- **Built-ins in the gallery**: also published for discovery/parity, or compiled-only?
