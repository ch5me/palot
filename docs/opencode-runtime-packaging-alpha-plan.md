# OpenCode Runtime Packaging Alpha Plan <!-- oc:id=sec_aa -->

This document is the durable authority for how Palot (Elf desktop) consumes
CI-produced portable-opencode artifacts. It covers the artifact handoff contract,
the packaged app resource destination, per-platform sourcing, verification
expectations, and the split between dev/local staging and CI/release embedding.

**Reader:** an engineer implementing Palot packaging, CI integration, or the
desktop runtime resolver.

**Post-read action:** you can stage the correct portable-opencode artifact into
a Palot build, wire the `extraResources` entry, resolve the bundled binary at
runtime, and verify the result at each stage.

## Current state <!-- oc:id=sec_ab -->

Elf has two OpenCode lifecycle paths today:

- Electron desktop main process: `apps/desktop/src/main/opencode-manager.ts`
  manages one local OpenCode server.
- Browser-mode backend: `apps/server/src/services/server-manager.ts` manages
  or attaches to one OpenCode server.

The browser-mode backend already has the right packaged-build contract:

- `OPENCODE_MODE=external` means fail loud unless a configured server is
  already responding.
- `OPENCODE_MODE=managed` means spawn OpenCode.
- `OPENCODE_BIN` can point at a bundled binary.
- Default managed port is `14096`, keeping shared dev host `4096` reserved.

The Electron desktop path is not there yet:

- It always spawns `opencode` from PATH with `~/.opencode/bin` prepended.
- It does not resolve a bundled `portable-opencode` sidecar.
- It does not expose a mode field in persisted local server settings.
- Its first-run environment check still asks for host OpenCode and offers
  `curl -fsSL https://opencode.ai/install | bash`.

So: one-click install is architecturally ready, but not implemented in the
desktop package.

## Portable OpenCode status <!-- oc:id=sec_ac -->

The `portable-opencode` repo owns the artifact boundary.

Working primitives:

- Native bundle build and tarball packaging: `scripts/build.sh`,
  `scripts/package-native.sh`, `scripts/install-native-artifact.sh`.
- npm-style launcher wrapper: `npm/bin/portable-opencode.mjs`.
- Container build and smoke path: `packaging/container/Dockerfile`,
  `packaging/container/entrypoint.sh`, `scripts/test-container-smoke.sh`.
- CI workflows for validate, native candidate, container candidate,
  golden promotion, mac-mini canary, and input reconciliation.
- Proof matrix documenting schema, build, smoke, OCI, golden, canary,
  and local validation levels.

Important portable behavior for Elf:

- The launcher isolates `HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME`,
  `XDG_STATE_HOME`, and `XDG_CACHE_HOME` under its runtime root.
- It copies bundled config, plugins, skills, and roles into that
  isolated runtime root.
- It executes the bundled OpenCode runtime binary rather than relying
  on a host install.

Local reality on this Mac:

- Host `opencode` exists at `/Users/hassoncs/.local/bin/opencode` and
  reports `0.0.0-chris-dev-202606160702`.
- `portable-opencode` is not currently on PATH.
- Running `scripts/test-portable-install.sh --target-profile partner-laptop
  --channel dev-snapshot` currently fails before build because sibling source
  `oh-my-opencode/src` is missing under `/Users/hassoncs/src/ch5`.

## Artifact Handoff Contract <!-- oc:id=sec_ak -->

This section is the binding contract between portable-opencode CI output
and Palot build input.

### Artifact Authority <!-- oc:id=sec_al -->

Portable-opencode CI produces three artifact families:

| Surface | CI workflow | Artifact name pattern | Format |
|---------|-------------|----------------------|--------|
| `mac-mini` | `build-candidate.yml` | `portable-opencode-{version}-darwin-arm64-arm64.tar.gz` | Native tarball |
| `dell-lxc` | `build-candidate.yml` | `portable-opencode-{version}-linux-x64-x64.tar.gz` | Native tarball |
| `container` | `build-container.yml` | `oci.ch5.me/ch5/portable-opencode:{version}` | OCI image |

Version string format: `candidate-{run_number}-{short_sha}` for candidates,
`golden-{tag}` for promoted releases.

CI upload artifact names (for GitHub Actions `download-artifact`):

- `candidate-mac-mini` (includes tarball, lock, smoke proof)
- `candidate-dell-lxc` (includes tarball, lock, smoke proof)
- `candidate-container-source` (metadata JSON)
- `candidate-surface-mac-mini` and `candidate-surface-dell-lxc` (surface metadata JSON)

Golden promotions attach tarballs as GitHub release assets on the
portable-opencode repo.

### Packaged App Destination <!-- oc:id=sec_am -->

The portable-opencode tarball extracts into the Electron app's
`process.resourcesPath` under a `portable-opencode/` directory.

**electron-builder.yml extraResources entry (to be added):**

```yaml
extraResources:
  # ... existing entries ...
  - from: resources/portable-opencode
    to: portable-opencode
    filter:
      - "**/*"
```

This produces the following runtime path in the packaged app:

| Platform | Resolved path |
|----------|---------------|
| macOS | `Elf.app/Contents/Resources/portable-opencode/` |
| Linux | `resources/portable-opencode/` |
| Windows | `resources/portable-opencode/` |

The launcher binary within the extracted artifact:

| Platform | Binary path relative to `process.resourcesPath` |
|----------|------------------------------------------------|
| macOS | `portable-opencode/bin/portable-opencode` |
| Linux | `portable-opencode/bin/portable-opencode` |
| Windows | `portable-opencode/bin/portable-opencode.cmd` |

The entire `portable-opencode/` directory inside the packaged app is
**read-only at runtime**. All mutable state (auth, sessions, config
overrides, cache) lives under `app.getPath("userData")/portable-opencode/`.

### Platform Contract <!-- oc:id=sec_an -->

| Platform | Artifact source | Alpha priority | Verification |
|----------|----------------|----------------|--------------|
| macOS arm64 | `candidate-mac-mini` tarball from `build-candidate.yml` | **Alpha target** | SHA256 checksum + `portable-opencode --version` exits 0 |
| macOS x64 | Same tarball (universal or arch-specific TBD) | Direction only | Same as arm64 |
| Linux x64 | `candidate-dell-lxc` tarball | Direction only | Same checksum + version probe |
| Windows x64 | Not yet produced by portable-opencode CI | Not planned for alpha | N/A |
| Container | `oci.ch5.me/ch5/portable-opencode:{version}` | Direction only (Windows fallback) | OCI healthcheck + smoke test |

**Alpha = macOS arm64 bundled-local first.** Other platforms are direction.

### Dev/Local Staging <!-- oc:id=sec_ao -->

For local development and dev builds, the portable-opencode artifact is
staged manually into the Palot repo before packaging.

**Staging directory:** `apps/desktop/resources/portable-opencode/`

**Staging steps (manual, until a helper script exists):**

1. Obtain a portable-opencode tarball (from CI artifact download or local
   portable-opencode build).
1. Create the staging directory:
   `mkdir -p apps/desktop/resources/portable-opencode`
1. Extract the tarball into that directory:
   `tar xzf portable-opencode-*.tar.gz -C apps/desktop/resources/portable-opencode --strip-components=1`
1. Verify the launcher exists:
   `test -x apps/desktop/resources/portable-opencode/bin/portable-opencode`

The `extraResources` entry in `electron-builder.yml` picks up whatever
is in `apps/desktop/resources/portable-opencode/` at package time.

**Dev override:** When running `electron-vite dev` (not a packaged build),
the desktop resolver should check for an explicit override environment
variable (`PORTABLE_OPENCODE_PATH` or similar) before falling back to
host `opencode` from PATH. This lets developers point at a local
portable-opencode build without repackaging.

**Important:** Local portable-opencode rebuild is currently blocked on
this machine (missing sibling `oh-my-opencode/src`). Dev/local staging
should use CI-produced artifacts, not local rebuilds, until that is
resolved. Do not make local rebuild the alpha authority.

### CI/Release Embedding <!-- oc:id=sec_ap -->

For CI builds and release packaging, the portable-opencode artifact is
consumed programmatically.

**CI flow (to be implemented in Palot CI):**

1. Pin a portable-opencode version (candidate run number + SHA, or
   golden tag). Store the pin in a Palot-owned config file
   (e.g., `apps/desktop/resources/portable-opencode-pin.json`).
1. Download the artifact from the portable-opencode GitHub release
   or from the HQ Deploy Depot candidate manifest.
1. Verify SHA256 checksum against the pinned digest.
1. Extract into `apps/desktop/resources/portable-opencode/`.
1. Run `electron-builder` package step (the `extraResources` entry
   picks up the staged artifact).
1. Post-package smoke test:
   - Fresh app profile (isolated `userData`).
   - Bundled artifact exists at expected `process.resourcesPath` location.
   - Managed runtime boots on port `14096`.
   - Renderer connects to the managed server.
   - First-run setup reaches Complete without requiring host `opencode`.

**Pin file format (proposed):**

```json
{
  "version": "candidate-16-138896b6340c",
  "surface": "mac-mini",
  "tarball": "portable-opencode-candidate-16-138896b6340c-darwin-arm64-arm64.tar.gz",
  "sha256": "abc123...",
  "source": "github-release",
  "sourceUrl": "https://github.com/ch5me/portable-opencode/releases/download/..."
}
```

### Verification Contract <!-- oc:id=sec_aq -->

Each stage has a minimum verification bar:

| Stage | What to verify | How |
|-------|---------------|-----|
| Staging (dev) | Launcher binary exists and is executable | `test -x resources/portable-opencode/bin/portable-opencode` |
| Staging (dev) | Version probe succeeds | `resources/portable-opencode/bin/portable-opencode --version` exits 0 |
| CI pre-package | Checksum matches pin | `shasum -a 256` compare |
| CI post-package | Bundled artifact present in `.app` bundle | Inspect `Contents/Resources/portable-opencode/bin/portable-opencode` |
| CI post-package | Smoke: managed runtime boots | Launch app with fresh profile, probe `http://127.0.0.1:14096/session` |
| Golden release | Full smoke matrix | Same as CI + first-run UI reaches Complete |

## Existing server data model <!-- oc:id=sec_ad -->

Persisted settings use:

- `LocalServerConfig`
  - `id: "local"`
  - `name`
  - `type: "local"`
  - `hostname?`
  - `port?`
  - `hasPassword?`
  - `mdns?`
  - `mdnsDomain?`
- `RemoteServerConfig`
  - `id`
  - `name`
  - `type: "remote"`
  - `url`
  - `username?`
  - `hasPassword?`
- `SshServerConfig`
  - defined for future use, not wired as a full product path.
- `ServerSettings`
  - ordered `servers`
  - `activeServerId`

Current model handles one active server and many saved servers. It does
not model runtime source or lifecycle ownership.

## Needed model extension <!-- oc:id=sec_ae -->

Add explicit runtime/lifecycle fields before replacing onboarding:

```ts
type LocalRuntimeKind = "bundled" | "host" | "container"
type LocalRuntimeOwnership = "managed" | "attach-only"

interface LocalServerConfig {
	id: "local"
	name: string
	type: "local"
	runtimeKind?: LocalRuntimeKind
	ownership?: LocalRuntimeOwnership
	hostname?: string
	port?: number
	binaryPath?: string
	runtimeRoot?: string
	containerImage?: string
	containerName?: string
	hasPassword?: boolean
	mdns?: boolean
	mdnsDomain?: string
}
```

Recommended default for alpha:

- `runtimeKind: "bundled"`
- `ownership: "managed"`
- `port: 14096`
- `runtimeRoot: app.getPath("userData")/portable-opencode/<environment>`
- `binaryPath: process.resourcesPath + "/portable-opencode/bin/portable-opencode"`

Add a separate discovered-runtime snapshot for UI health. Do not store
transient health directly as canonical settings:

```ts
interface DiscoveredOpenCodeRuntime {
	id: string
	kind: "bundled" | "host" | "port" | "mdns" | "remote"
	url?: string
	port?: number
	binaryPath?: string
	version?: string
	ownerUid?: number | null
	managed: boolean
	health: "unknown" | "ready" | "starting" | "failed"
	lastSeenAt: string
}
```

## First-run setup workflow <!-- oc:id=sec_af -->

Current UI flow:

1. Welcome. <!-- oc:id=item_aa -->
1. Environment Check. <!-- oc:id=item_ab -->
1. Provider Setup. <!-- oc:id=item_ac -->
1. Complete. <!-- oc:id=item_ad -->
1. Optional migration detour. <!-- oc:id=item_ae -->

Current Environment Check behavior:

- Runs `window.elf.onboarding.checkOpenCode()`.
- Checks host `opencode --version`.
- Shows install/update UI if missing or too old.
- Offers discovered mDNS servers and manual remote URL only when
  host CLI is missing.

Target alpha flow:

1. Welcome. <!-- oc:id=item_af -->
1. Runtime Choice. <!-- oc:id=item_ag -->
   - Bundled runtime: recommended/default.
   - Existing local server: attach if same-user port probe succeeds.
   - Existing host binary: managed host runtime if user prefers it.
   - Network/remote: mDNS or manual URL.
1. Runtime Verification. <!-- oc:id=item_ah -->
   - Verify selected runtime binary or URL.
   - Boot managed runtime if needed.
   - Probe `/session` or equivalent readiness endpoint.
1. Provider Setup / migration. <!-- oc:id=item_ai -->
1. Complete. <!-- oc:id=item_aj -->

The setup UI should always show remote/manual options, not only after
CLI failure.

## Detection plan <!-- oc:id=sec_ag -->

On first launch and in Settings, run a bounded scan:

- Bundled artifact exists and `portable-opencode --version` or `--help`
  exits successfully.
- Host binary exists via augmented PATH and `opencode --version` works.
- Known local ports respond: `4096`, configured local port, `14096`,
  and lockfile port if present.
- Listening port owner is current OS user before attaching.
- mDNS discovers OpenCode peers.
- Manual URLs can be tested with optional auth.

Attach rules:

- Same-user existing listener: safe attach candidate.
- Different-user listener: conflict, fail loud.
- Missing bundled artifact in packaged build: repair/reinstall runtime
  payload, not curl install.
- Missing host OpenCode is not a blocker if bundled runtime is available.

## Runtime spawn contract <!-- oc:id=sec_ar -->

When the desktop resolver selects the bundled runtime, spawn it with:

```
portable-opencode serve \
  --hostname=127.0.0.1 \
  --port=14096
```

Set `PORTABLE_OPENCODE_NPM_HOME` (or the equivalent runtime root env)
to `app.getPath("userData")/portable-opencode/runtime` so that all
mutable state lands outside the app bundle.

The bundled artifact directory is immutable. Never write into
`process.resourcesPath/portable-opencode/` at runtime.

## Local test status <!-- oc:id=sec_ai -->

Storybook is running at `http://localhost:10618`.

Added Storybook board:

- `packages/ui/src/stories/ai-elements/opencode-setup-flow.stories.tsx`
- URL: `http://localhost:10618/?path=/story/ai-elements-launch-opencode-setup-flow--alpha-decision-board`

Verified:

- Storybook service running via devmux.
- Story URL returns HTTP 200.
- New story passes Biome check.
- `packages/ui` typecheck passes.

Browser lane is not bound in this OpenCode session, so visual proof
was limited to Storybook HTTP load rather than screenshot inspection.

## Decision recommendation <!-- oc:id=sec_aj -->

For alpha, ship bundled native portable OpenCode as the default managed
runtime.

Keep these as secondary paths:

- attach to existing same-user local OpenCode server,
- use host-installed OpenCode by explicit user choice,
- connect to mDNS/manual remote server,
- explore container runtime for Windows and remote worker lanes.

Do not require users to install OpenCode separately for the one-DMG path.
