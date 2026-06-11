# Task 7 — V2 Manifest Schema and Source-of-Truth Object <!-- oc:id=sec_aa -->

> Wave 2, Task 7 of plan `firefly-plugin-system-v2`. Do not modify the plan file.

## What this means for V2 <!-- oc:id=sec_ab -->

V2 unifies four canonical runtime objects (per plan §`Source Of Truth Model`):

1. `PluginManifest` — static disk artifact, never holds runtime state <!-- oc:id=item_aa -->
1. `PluginDescriptor` — host-owned validated form, canonical contribution source of truth <!-- oc:id=item_ab -->
1. `PluginInstance` — host-owned runtime lifecycle record for one activated plugin <!-- oc:id=item_ac -->
1. `PluginSessionHandle` — host-owned session-scoped view for one OpenCode session <!-- oc:id=item_ad -->

Every projection (`Renderer`, `OpenCode`, `Lifecycle`, `Policy`) consumes from these four. The Zod manifest below defines the wire shape; the descriptor and instance objects are produced from it.

## 1. Manifest top-level shape (Zod sketch) <!-- oc:id=sec_ac -->

```ts
// packages/firefly-client-sdk/src/manifest.ts
import { z } from "zod"

export const manifestIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/, "reverse-domain id required")

export const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/)

export const apiTierSchema = z.enum(["stable", "proposed", "internal"])

export const capabilitySchema = z.enum([
  "fs:plugin",
  "fs:read",
  "fs:write",
  "net",
  "shell",
  "clipboard",
  "ai",
  "host:ui",
  "host:commands",
  "host:themes",
  "host:widgets",
  "bridge:session-read",
  "bridge:session-write",
  "bridge:ui-state-read",
  "bridge:ui-state-write",
  "browser:lane-control",
  "theme:apply",
  "command:register",
  "tool:register",
  "feature_flag",
])

export const trustTierSchema = z.enum(["built-in", "local-dev", "signed-third-party"])

export const activationEventSchema = z.enum([
  "onStartup",
  "onCommand",
  "onPanelOpen",
  "onWidgetMount",
  "onToolCall",
  "onSessionAttach",
  "onThemeApply",
  "lazy",
])

export const panelContributionSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string().optional(),
  location: z.enum(["sidebar-left", "sidebar-right", "bottom", "main"]),
  surface: z.enum(["reconciler", "iframe"]).default("reconciler"),
  entry: z.string(),
  defaultEnabled: z.boolean().default(true),
  requiresCapabilities: z.array(capabilitySchema).default([]),
  when: z.string().optional(),
})

export const widgetContributionSchema = z.object({
  id: z.string(),
  title: z.string(),
  zoneId: z.enum(["above-chat", "chat-inline-right"]),
  defaultEnabled: z.boolean().default(true),
  entry: z.string(),
  requiresCapabilities: z.array(capabilitySchema).default([]),
})

export const commandContributionSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().optional(),
  icon: z.string().optional(),
  shortcut: z.string().optional(),
  menu: z.array(z.enum(["palette", "sidebar", "panel-header", "context"])).default(["palette"]),
  when: z.string().optional(),
  handlerPluginOnly: z.boolean().default(false),
  requiresCapabilities: z.array(capabilitySchema).default([]),
})

export const themeContributionSchema = z.object({
  id: z.string(),
  label: z.string(),
  uiTheme: z.enum(["vs", "vs-dark", "hc-black", "hc-light"]),
  data: z.record(z.string(), z.unknown()),
  precedence: z.number().int().min(0).max(100).default(50),
  dataOnly: z.literal(true),
})

export const toolContributionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()),
  sessionScope: z.enum(["session", "project", "app"]).default("session"),
  timeoutMs: z.number().int().positive().default(60_000),
  dispatchingCeilingMs: z.number().int().positive().default(5_000),
  requiresCapabilities: z.array(capabilitySchema).default([]),
  uiHints: z.record(z.string(), z.unknown()).optional(),
})

export const keybindingContributionSchema = z.object({
  commandId: z.string(),
  key: z.string(),
  when: z.string().optional(),
})

export const menuContributionSchema = z.object({
  location: z.enum(["sidebar", "panel-header", "context", "app"]),
  commandId: z.string(),
  when: z.string().optional(),
})

export const manifestSchema = z.object({
  id: manifestIdSchema,
  name: z.string(),
  version: semverSchema,
  publisher: z.string(),
  apiVersion: semverSchema,           // SDK version this manifest is built against
  fireflyClientVersion: semverSchema,  // host SDK version this manifest requires
  tier: apiTierSchema.default("stable"),
  trust: trustTierSchema,
  signature: z.string().optional(),      // detached signature for signed tiers
  main: z.string(),                      // worker entry
  activation: z.array(activationEventSchema).default(["lazy"]),
  contributes: z.object({
    panels: z.array(panelContributionSchema).default([]),
    widgets: z.array(widgetContributionSchema).default([]),
    commands: z.array(commandContributionSchema).default([]),
    themes: z.array(themeContributionSchema).default([]),
    tools: z.array(toolContributionSchema).default([]),
    keybindings: z.array(keybindingContributionSchema).default([]),
    menus: z.array(menuContributionSchema).default([]),
  }),
  capabilities: z.array(capabilitySchema).default([]),
  networkDomains: z.array(z.string()).default([]),
  deprecations: z.array(z.object({
    field: z.string(),
    since: semverSchema,
    until: semverSchema.optional(),
    replacement: z.string().optional(),
  })).default([]),
})
```

## 2. Object-to-object split <!-- oc:id=sec_ad -->

| Field | `PluginManifest` | `PluginDescriptor` | `PluginInstance` | `PluginSessionHandle` |
|---|---|---|---|---|
| id, version, publisher | yes | yes | yes | yes |
| apiVersion, fireflyClientVersion | yes | yes | yes | — |
| tier, trust | yes | yes | yes | — |
| signature | yes | yes | — | — |
| `main` entry | yes | yes | — | — |
| `activation[]` | yes | yes | yes (current effective set) | session-scoped filter |
| `contributes.*` | yes | yes (normalized) | — | — |
| `capabilities[]` | yes | yes | yes (granted subset) | yes (granted subset) |
| `networkDomains[]` | yes | yes | — | — |
| transport handle | — | — | yes | yes |
| crash counter | — | — | yes | — |
| quarantine state | — | — | yes | — |
| activation status | — | — | yes | — |
| session availability | — | — | — | yes |
| per-session tool exposure | — | — | — | yes |

`PluginDescriptor` is the result of Zod-parse + host normalization of `PluginManifest`. It is the canonical contribution source of truth. `PluginInstance` is a runtime lifecycle record; it does not redefine contributions. `PluginSessionHandle` is per-session metadata; it does not redefine capabilities.

## 3. Field-to-projection map <!-- oc:id=sec_ae -->

| Manifest field | Renderer projection reads | OpenCode projection reads | Lifecycle projection reads | Policy projection reads |
|---|---|---|---|---|
| `contributes.panels[]` | yes | yes (introspection only) | yes (id uniqueness) | — |
| `contributes.widgets[]` | yes | — | yes | — |
| `contributes.commands[]` | yes | yes (host wrappers + plugin tools) | yes | — |
| `contributes.themes[]` | yes | yes (introspection only) | yes | — |
| `contributes.tools[]` | — | yes | yes (timeout ceilings) | yes (capability gating) |
| `contributes.keybindings[]` | yes | — | — | — |
| `contributes.menus[]` | yes | — | — | — |
| `capabilities[]` | — | yes (availability) | yes (broker rules) | yes (deny default) |
| `networkDomains[]` | — | yes (gateway rules) | yes | yes |
| `apiVersion`, `fireflyClientVersion` | — | — | yes (compatibility gate) | yes |
| `tier` | — | — | — | yes (stability policy) |
| `deprecations[]` | — | yes (tool metadata) | yes | yes |

## 4. Identity, version, namespaces <!-- oc:id=sec_af -->

- id format: reverse-domain, lowercased, dot-separated segments
- version: semver with optional pre-release tag
- built-in ids reserved namespace: `firefly.*` and `palot.*` (compat)
- third-party ids live in their own publisher-owned space
- tool ids: host reserves `plugins.*`; plugins use `plugin.<pluginId>.*`
- command ids: host reserves the namespaces listed in Task 3 §6
- theme ids: globally unique within host catalog; collision rejects activation

## 5. Compatibility and tiering rules <!-- oc:id=sec_ag -->

- `fireflyClientVersion` is the host SDK version this manifest is built against. Host refuses plugins with a strictly newer required version.
- `apiVersion` is the manifest schema version. Host ships the Zod schema; plugin must compile against it.
- `tier: stable` means host will not change the schema under the plugin's feet in a patch release.
- `tier: proposed` means the schema may change; plugin must subscribe to `deprecations[]`.
- `tier: internal` means visible only to built-in plugins; rejected for third-party.
- `deprecations[]` lists every field the host plans to remove; host enforces `until` semver.

## 6. Built-in vs local-dev vs third-party <!-- oc:id=sec_ah -->

| Concern | built-in | local-dev | signed-third-party |
|---|---|---|---|
| package location | `apps/desktop/.firefly-client/built-in/<id>/` (new) | `apps/desktop/.firefly-client/local-dev/<id>/` (new) | `apps/desktop/.firefly-client/installed/<id>/<version>/` (new) |
| `trust` value | `built-in` | `local-dev` | `signed-third-party` |
| signature required | no | no | yes |
| capability defaults | broadest | broadest | minimal; user prompts |
| activation default | `["onStartup"]` | `["lazy"]` | `["lazy"]` |
| source of contributions | ship with the desktop build | ship with the desktop build | remote or local VSIX-derived bundle |
| update path | rebuilt with app | rebuilt with app | `update` lifecycle op + signature verify |

## 7. Example manifest (one plugin, four families) <!-- oc:id=sec_ai -->

```jsonc
{
  "id": "palot.git",
  "name": "Git",
  "version": "1.2.0",
  "publisher": "ch5me",
  "apiVersion": "2.0.0",
  "fireflyClientVersion": "2.0.0",
  "tier": "stable",
  "trust": "built-in",
  "main": "./dist/main.js",
  "activation": ["onStartup", "onCommand:git.run-status"],
  "contributes": {
    "panels": [
      {
        "id": "git",
        "title": "Git",
        "icon": "git-branch",
        "location": "sidebar-right",
        "surface": "reconciler",
        "entry": "./view.js#GitPanel",
        "defaultEnabled": true,
        "requiresCapabilities": ["fs:read", "fs:write"]
      }
    ],
    "commands": [
      {
        "id": "plugin.git.open-repo",
        "title": "Open Repository",
        "menu": ["palette", "context"],
        "requiresCapabilities": ["fs:read"]
      },
      {
        "id": "plugin.git.run-status",
        "title": "Run git status",
        "menu": ["palette"],
        "requiresCapabilities": ["shell", "fs:read"]
      }
    ],
    "tools": [
      {
        "name": "git_status",
        "description": "Run `git status` in a worktree or current directory.",
        "inputSchema": {
          "type": "object",
          "properties": { "cwd": { "type": "string" } },
          "required": ["cwd"]
        },
        "sessionScope": "session",
        "timeoutMs": 15000,
        "dispatchingCeilingMs": 5000,
        "requiresCapabilities": ["shell", "fs:read"]
      }
    ],
    "themes": [
      {
        "id": "ch5me.cortex-dark",
        "label": "Cortex Dark (Git Plugin)",
        "uiTheme": "vs-dark",
        "data": { "git.uncommittedCount.color": "#ff8800" },
        "precedence": 30,
        "dataOnly": true
      }
    ]
  },
  "capabilities": ["fs:read", "fs:write", "shell", "host:commands", "tool:register"],
  "networkDomains": [],
  "deprecations": []
}
```

## 8. Source-of-truth boundaries (locked) <!-- oc:id=sec_aj -->

- `PluginManifest` is the only object that lives on disk before Zod parse.
- `PluginDescriptor` is computed once, in main, after Zod parse + host normalization. It is the canonical contribution source of truth and is what every projection reads.
- `PluginInstance` is the only object that holds live process handles. Projections may reference it for status, but never for contribution shape.
- `PluginSessionHandle` is per-session; projections filter tools/availability by it. It does not redefine capabilities.
- No projection reads from disk. All projections are computed in main from the four canonical runtime objects (per plan §`Source Of Truth Model`).