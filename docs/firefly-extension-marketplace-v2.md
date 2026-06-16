# Firefly Extension Marketplace V2

Date: 2026-06-16

Purpose: design the Palot / Firefly plugin system toward a VS Code-like extension model without cloning VS Code's runtime or coupling extensions to renderer internals.

Current Palot truth:

- Manifest spine already exists at `apps/desktop/src/shared/firefly-plugin/manifest.ts`.
- Capability broker and projections already exist; keep manifest -> catalog -> renderer projection as the core contract.
- Hot reload already rejects module-cache hacks and requires restart/reproject cycles.
- VS Code import stance already exists: classifier + transpile-only, no runtime shim, no hidden sidecar.
- Theme pipeline already treats VS Code / Open VSX imports as converted V2 theme contributions.

External references checked:

- VS Code extension manifest: https://code.visualstudio.com/api/references/extension-manifest
- VS Code extension host: https://code.visualstudio.com/api/advanced-topics/extension-host
- VS Code contribution points: https://code.visualstudio.com/api/references/contribution-points
- VS Code color themes: https://code.visualstudio.com/api/extension-guides/color-theme
- Open VSX API: https://open-vsx.org/v3/api-docs

## Design stance

Do not implement "VS Code compatibility" as a runtime promise. Implement a native Firefly extension system with a VS Code-shaped package/import adapter.

Rules:

- Manifest is source of truth. Runtime state never mutates the package manifest.
- Renderer never loads extension code. Renderer consumes host projections only.
- Extension host talks to main process over typed RPC. Main process owns capability checks.
- Marketplace install writes immutable package bytes plus mutable install records.
- VS Code / Open VSX import starts with data-only extensions: themes, snippets, icon themes, language metadata. Runtime extensions are classified before conversion.
- No silent fallback. Unsupported VS Code API means rejected import or explicit degraded contribution.

## Host architecture

Target host split:

```text
marketplace source / local vsix
  -> package resolver
  -> signature + checksum verifier
  -> manifest parser
  -> compatibility solver
  -> catalog descriptor
  -> projections
      -> renderer UI projection
      -> command palette projection
      -> agent tool projection
      -> theme projection

activation request
  -> lifecycle supervisor
  -> capability broker
  -> extension host RPC
  -> host service / storage / workspace API
```

Host kinds:

| Host kind | Runs code? | Use for | Isolation |
| --- | --- | --- | --- |
| `data-only` | no | themes, snippets, language config, icon themes | manifest validation only |
| `builtin-main` | yes, host-owned | Palot built-ins during migration | main process handlers |
| `node-worker` | yes | trusted / signed extensions needing Node/workspace APIs | utility process or worker thread |
| `web-worker` | yes | browser-safe extensions | worker, no Node |
| `iframe-view` | yes, UI only | webviews or remote UI panels | sandboxed iframe, explicit message bridge |

V2 should prefer one process per trust/runtime group, not one process per extension. Crash policy can quarantine one extension while restarting the host group if state maps extension id -> activation context.

## Native extension types

`PluginManifest.contributes` should keep growing by contribution family, not by "plugin type". A plugin may contribute multiple families.

Core families:

| Family | VS Code analogue | Firefly projection | V2 priority |
| --- | --- | --- | --- |
| `themes` | `contributes.themes` | CSS token map + editor token map | P0 |
| `commands` | `contributes.commands` | command palette, menus, keybindings | P0 |
| `panels` | views / webviews | side panel / main pane projection | P0 |
| `widgets` | custom view-ish | session-scoped widget zones | P0 |
| `tools` | no exact VS Code analogue | agent-callable tools | P0 |
| `configuration` | `contributes.configuration` | settings schema + defaults | P1 |
| `languages` | `contributes.languages` | language metadata, file globs, icons | P1 |
| `grammars` | `contributes.grammars` | TextMate grammar registration | P1 |
| `snippets` | `contributes.snippets` | editor completion snippets | P1 |
| `iconThemes` | `contributes.iconThemes` | product/file icon resolver | P2 |
| `debuggers` | `contributes.debuggers` | explicit reject or native debug adapter contract | P3 |

Avoid "extension category" as behavior. Category is marketplace/search metadata. Behavior is contribution family + capability request + host kind.

## Compatibility model

Use three compatibility layers.

### 1. Package semver

Package version is normal SemVer:

```ts
type ExtensionVersion = `${number}.${number}.${number}${string}`
```

Store exact published version. Do not mutate it for local install state.

### 2. Host compatibility

Native manifest:

```json
{
  "engines": {
    "firefly": ">=0.12.0 <1.0.0"
  },
  "apiVersion": "firefly.plugin/v2",
  "manifestRevision": 1
}
```

Current schema uses `engines.desktop`; rename or alias to `engines.firefly` before third-party launch. `desktop` describes one runtime, not API compatibility.

Acceptance:

- Reject when `apiVersion` major unsupported.
- Reject when `manifestRevision` above host max.
- Reject when host app semver does not satisfy `engines.firefly`.
- Warn when manifest uses proposed API tier.
- Reject third-party use of internal API tier.

### 3. VS Code import compatibility

VS Code `engines.vscode` is not a Firefly compatibility claim. Treat it as importer input:

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

Then classify with existing `green | yellow | orange | red` import tiers.

## Marketplace model

Use Open VSX as first-class remote source. It exposes search, metadata, version, files, download, signature, checksum, and VS Code gallery-compatible query surfaces.

Do not depend on Visual Studio Marketplace as default. It is useful for metadata parity research, but licensing and access are not as clean as Open VSX. Support manual VSIX import and maybe a "VS Code Marketplace URL -> try Open VSX equivalent -> else manual VSIX" flow.

Data model:

```ts
interface RegistrySource {
  id: string
  kind: "open-vsx" | "firefly" | "local-folder" | "local-vsix"
  baseUrl: string | null
  enabled: boolean
  trustPolicy: "builtin" | "verified-only" | "allow-unsigned-with-consent"
  lastSyncAt: string | null
}

interface MarketplaceExtension {
  registryId: string
  namespace: string
  name: string
  displayName: string
  description: string
  categories: string[]
  tags: string[]
  latestVersion: string
  verified: boolean
  deprecated: boolean
  downloadCount: number | null
  rating: number | null
  iconUrl: string | null
  homepageUrl: string | null
  repositoryUrl: string | null
}

interface MarketplaceVersion {
  registryId: string
  namespace: string
  name: string
  version: string
  targetPlatform: "universal" | "web" | "darwin-arm64" | "darwin-x64" | "linux-x64" | "win32-x64"
  engines: Record<string, string>
  extensionKind: Array<"ui" | "workspace" | "web">
  categories: string[]
  files: {
    manifest?: string
    readme?: string
    license?: string
    download: string
    sha256?: string
    signature?: string
    icon?: string
  }
  publishedAt: string
  preRelease: boolean
  rawMetadataHash: string
}
```

Package store:

```ts
interface ExtensionPackage {
  packageId: string
  source: "registry" | "local-vsix" | "local-folder"
  registryId: string | null
  namespace: string
  name: string
  version: string
  targetPlatform: string
  contentSha256: string
  vsixPath: string | null
  unpackedPath: string
  manifestPath: string
  signatureState: "verified" | "missing" | "failed" | "not-applicable"
  scanState: "pending" | "passed" | "failed" | "quarantined"
  createdAt: string
}
```

Install state:

```ts
interface ExtensionInstallation {
  installationId: string
  pluginId: string
  packageId: string
  scope: "app" | "profile" | "workspace"
  workspaceId: string | null
  enabled: boolean
  pinnedVersion: string | null
  updatePolicy: "manual" | "patch" | "minor" | "latest"
  trustTier: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
  lifecycleState:
    | "installed"
    | "disabled"
    | "activating"
    | "active"
    | "reload-required"
    | "quarantined"
    | "uninstalling"
    | "removed"
  installedAt: string
  updatedAt: string
}
```

Capability grants:

```ts
interface ExtensionCapabilityGrant {
  pluginId: string
  scope: "app" | "workspace" | "session"
  scopeId: string | null
  capability: string
  grantState: "granted" | "denied" | "prompt-required"
  grantedBy: "builtin-policy" | "user" | "admin-policy"
  reason: string
  createdAt: string
  expiresAt: string | null
}
```

Runtime instances:

```ts
interface ExtensionRuntimeInstance {
  runtimeId: string
  pluginId: string
  hostKind: "data-only" | "builtin-main" | "node-worker" | "web-worker" | "iframe-view"
  pid: number | null
  activationEvent: string
  state: "starting" | "ready" | "stopping" | "crashed" | "quarantined"
  lastHeartbeatAt: string | null
  crashCountWindow: number
  startedAt: string
}
```

## Install / uninstall lifecycle

Install:

1. Resolve source and version.
2. Download VSIX or read local folder.
3. Verify checksum/signature when available.
4. Unpack to content-addressed package store.
5. Parse package manifest.
6. Convert native / VS Code manifest into Firefly V2 manifest descriptor.
7. Solve host compatibility.
8. Classify trust + capability prompts.
9. Write immutable `ExtensionPackage`.
10. Write mutable `ExtensionInstallation`.
11. Project catalog.
12. Activate only on activation event.

Uninstall:

1. Disable installation.
2. Stop runtime instance.
3. Remove projections.
4. Leave package bytes until no installation references them.
5. Garbage collect unreferenced packages later.
6. Preserve user settings/state behind explicit "remove data" option.

Hot reload:

- Local folder change -> rebuild descriptor -> restart extension host when manifest or code changed.
- Theme-only change -> reproject theme and republish projections.
- Worker code change -> restart process. No module cache invalidation.
- All projection outputs must publish together: renderer, command, agent tool, theme.

## VS Code theme import

VS Code theme package shape:

```json
{
  "contributes": {
    "themes": [
      {
        "label": "Example Dark",
        "uiTheme": "vs-dark",
        "path": "./themes/example-color-theme.json"
      }
    ]
  }
}
```

Theme file shape:

```json
{
  "type": "dark",
  "colors": {
    "editor.background": "#1e1e1e",
    "sideBar.background": "#252526"
  },
  "tokenColors": [
    {
      "scope": "comment",
      "settings": { "foreground": "#6a9955", "fontStyle": "italic" }
    }
  ],
  "semanticTokenColors": {
    "variable.readonly": "#4fc1ff"
  }
}
```

Convert into two layers:

```ts
interface ImportedThemeContribution {
  id: string
  label: string
  kind: "light" | "dark" | "high-contrast"
  source: {
    registry: "open-vsx" | "manual-vsix"
    externalId: string
    version: string
    themePath: string
    contentSha256: string
  }
  appTokens: Record<string, string>
  editorTokens: {
    vscodeColors: Record<string, string>
    textMateTokenColors: unknown[]
    semanticTokenColors: Record<string, unknown>
  }
  unsupportedColorIds: string[]
}
```

Conversion policy:

- `colors` -> app CSS variables through explicit mapping table.
- Unmapped VS Code color ids preserved in `editorTokens.vscodeColors`.
- `tokenColors` -> Monaco/TextMate token theme, not general app chrome.
- `semanticTokenColors` -> Monaco semantic token theme.
- `uiTheme` maps to Firefly `kind`: `vs` -> light, `vs-dark` -> dark, `hc-black` / `hc-light` -> high contrast.
- Preview never mutates applied theme.
- Imported theme becomes normal V2 `themes` contribution with `imports.source = "open-vsx"` or `"vscode-theme"`.

Initial color mapping table:

| VS Code color id | Firefly token |
| --- | --- |
| `editor.background` | `--ff-editor-bg` |
| `editor.foreground` | `--ff-editor-fg` |
| `sideBar.background` | `--ff-sidebar-bg` |
| `sideBar.foreground` | `--ff-sidebar-fg` |
| `activityBar.background` | `--ff-activity-bg` |
| `activityBar.foreground` | `--ff-activity-fg` |
| `statusBar.background` | `--ff-status-bg` |
| `statusBar.foreground` | `--ff-status-fg` |
| `panel.background` | `--ff-panel-bg` |
| `panel.border` | `--ff-panel-border` |
| `tab.activeBackground` | `--ff-tab-active-bg` |
| `tab.inactiveBackground` | `--ff-tab-inactive-bg` |
| `button.background` | `--ff-button-bg` |
| `button.foreground` | `--ff-button-fg` |
| `input.background` | `--ff-input-bg` |
| `input.foreground` | `--ff-input-fg` |
| `focusBorder` | `--ff-focus-ring` |
| `selection.background` | `--ff-selection-bg` |

V1 importer should support only themes where:

- package manifest has `contributes.themes`;
- theme file is JSON, not only `.tmTheme`;
- no extension activation code is needed to produce theme data;
- package license is present and displayable;
- checksum can be stored.

## UX model

Marketplace UI should show:

- source: Open VSX / local / Firefly
- trust: verified / signed / unsigned / local-dev
- compatibility: compatible / needs consent / unsupported
- contribution families: theme, command, panel, tool, language, grammar
- requested capabilities grouped by risk
- install scope: app, profile, workspace
- current lifecycle: active, disabled, reload-required, quarantined

Important: "Install" is not "activate". Install writes bytes and metadata. Activation happens when a declared activation event fires.

## Implementation plan

Phase 1: theme marketplace slice

- Add Open VSX search client for query/category/theme.
- Add package store and install tables.
- Add VSIX download/unpack/manifest parser.
- Convert `contributes.themes` into V2 theme contributions.
- Add theme preview/apply UI backed by existing theme pipeline.
- Add local VSIX import for themes.

Phase 2: data-only VS Code imports

- Add snippets, language metadata, grammars, icon themes.
- Add contribution family schemas to native manifest.
- Add Monaco registration projection for language/grammar/theme data.

Phase 3: native runtime extensions

- Add extension host RPC protocol.
- Move non-data third-party code into `node-worker` / `web-worker`.
- Thread per-call capability grants through command and tool dispatch.
- Add extension storage API: global, workspace, secret placeholder.

Phase 4: constrained VS Code runtime import

- Implement importer for green-tier command/config/language extensions.
- Use `vscode.d.ts` as compile-time semantic input only.
- Reject unsupported VS Code APIs at import.
- Never ship a hidden VS Code sidecar.

## Open decisions

- Native host engine field should become `engines.firefly`; keep `engines.desktop` as migration alias until all built-ins update.
- Package store should likely live under XDG data: `~/.local/share/elf/extensions/packages/<sha256>/`.
- Install state should likely live in existing app database, not JSON files, because scope/profile/workspace queries matter.
- Marketplace cache can be SQLite rows with raw metadata hash, not loose JSON blobs.
- Visual Studio Marketplace direct install needs legal/product approval. Open VSX and manual VSIX are clean enough for V2.
