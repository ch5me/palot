# Task 21 — First-Party Exemplar Plugin Vertical Slice <!-- oc:id=sec_aa -->

> Wave 4, Task 21 of plan `firefly-plugin-system-v2`. Do not modify the plan file.
> Reads: Task 1 contribution inventory, Task 7 manifest schema, Task 8 family contracts, Task 13 renderer projection, Task 17 commands projection, Task 19 first-party migration.

## 1. Exemplar choice and rationale <!-- oc:id=sec_ab -->

Choice: **`palot.review-panel`** — a first-party plugin that owns the existing `review` side panel plus its `git-status` companion panel.

Why this exemplar:
- exercises every contribution family in V2: `panels` (review), `commands` (open/toggle), `themes` (one optional data token override), `tools` (one business tool: `plugin.palot.review-panel.list_changed_files`)
- exercises host storage (`pluginStorage` for last-viewed file), capability gating (`fs:read` for diff rendering, `shell` for git status, `theme:contribute` for the optional token), and lifecycle events (`onSessionAttach`, `onCommand`)
- non-trivial but not exotic; its current implementation in `apps/desktop/src/renderer/components/review/review-panel.tsx` is real code we can map to V2
- proves that the existing first-party path is exercisable end-to-end through one plugin before we attempt to migrate every other surface
- lets Task 22 third-party exemplar (an external "git-aware todo" plugin) cleanly contrast trust/permission behavior without competing for the same UI

Non-goals: it is not the only first-party plugin we will build. The Browse, Browser, Browser-panel, Files, Memory, Notes, Pulse, Terminal, Editor, Artifacts, PDF Review, CRM, Studio, Voice, Oracle, Claude, and CH5PM panels get their own first-party plugins per Task 19. The exemplar only needs to prove the V2 path works.

## 2. Manifest draft <!-- oc:id=sec_ac -->

```jsonc
{
  "id": "palot.review-panel",
  "name": "Review Panel",
  "version": "1.4.0",
  "publisher": "ch5me",
  "apiVersion": "2.0.0",
  "fireflyClientVersion": "2.0.0",
  "tier": "stable",
  "trust": "built-in",
  "main": "./dist/main.js",
  "activation": ["onStartup", "onSessionAttach"],
  "contributes": {
    "panels": [
      {
        "id": "review",
        "title": "Changes",
        "icon": "file-diff",
        "location": "sidebar-right",
        "surface": "reconciler",
        "entry": "./view.js#ReviewPanel",
        "defaultEnabled": true,
        "requiresCapabilities": ["fs:read"]
      }
    ],
    "commands": [
      {
        "id": "plugin.palot.review-panel.open",
        "title": "Open Review Panel",
        "menu": ["palette", "app-menu/file"],
        "shortcut": "Shift+Cmd+R",
        "requiresCapabilities": []
      },
      {
        "id": "plugin.palot.review-panel.refresh",
        "title": "Refresh Review",
        "menu": ["palette", "panel-header"],
        "requiresCapabilities": ["fs:read", "shell"]
      }
    ],
    "tools": [
      {
        "name": "list_changed_files",
        "description": "List files changed in the current session's working tree with their change type and added/removed line counts.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "sessionId": { "type": "string" },
            "since": { "type": "string", "enum": ["session-start", "last-save", "last-tool-call"] }
          },
          "required": ["sessionId"]
        },
        "sessionScope": "session",
        "timeoutMs": 8000,
        "dispatchingCeilingMs": 2000,
        "requiresCapabilities": ["shell", "fs:read"]
      }
    ],
    "themes": [
      {
        "id": "palot.review-panel.marker",
        "label": "Review Panel Markers",
        "uiTheme": "vs-dark",
        "data": {
          "review.unreviewedAccent": "hsl(38 92% 50%)"
        },
        "precedence": 30,
        "dataOnly": true
      }
    ]
  },
  "capabilities": ["fs:read", "shell", "host:ui", "host:commands", "host:themes", "tool:register", "theme:contribute"],
  "networkDomains": [],
  "deprecations": []
}
```

Companion-builtin projection: `surface.review.open` and `surface.review.toggle` ids are emitted by the host as `pluginId: "*"` host-reserved projections derived from the `review` panel declaration, not by the manifest. The plugin does not own those surface commands. This keeps the old V1 palette behavior working while V2 is rolled in.

## 3. State transitions it exercises <!-- oc:id=sec_ad -->

| Phase | Transition | What it proves |
|---|---|---|
| startup | `discovered -> validated -> installed -> activating -> active` | host lifecycle works end-to-end on a built-in |
| session attach | `PluginSessionHandle.established` fires for each new OpenCode session | session projection is wired |
| capability grant | user grants `shell` per-project via settings | capability broker decision path works |
| tool call | `plugin.palot.review-panel.list_changed_files` invoked -> `queued -> dispatching -> running -> completed` | 9-state machine works for a real plugin |
| hot reload | dev mode saves a file -> `tearing-down -> spawning -> activating -> active` | atomic descriptor swap + ordered publish works |
| disable | user disables the plugin from the operator UI -> `active -> disabled` | disable semantics work without leaving UI in invalid state |
| uninstall | user uninstalls the plugin -> `active -> removed` | session widget mount state and open panel are torn down correctly |
| quarantine | capability violation triggers `quarantined` posture | audit + quarantine trigger works |

## 4. What it proves for the architecture <!-- oc:id=sec_ae -->

1. The renderer projection stream (Task 13) can carry a non-trivial panel with telemetry, command ids, and availability state. <!-- oc:id=item_aa -->
1. The OpenCode projection (Task 14) can serialize a real tool with Zod schema, capability list, timeout ceilings, and provenance into the agent's tool list. <!-- oc:id=item_ab -->
1. The capability broker (Task 10) handles a real per-project grant flow for a real first-party plugin. <!-- oc:id=item_ac -->
1. The 9-state tool-call state machine (Task 9) works for a real `shell`-using tool, including its `permission_denied` and `tool_unavailable` paths. <!-- oc:id=item_ad -->
1. The host runtime supervision (Task 11) handles a real worker with `shell` capability without leaking crashes into the main process. <!-- oc:id=item_ae -->
1. The hot-reload path (Task 18) round-trips a manifest edit without a renderer flicker or an OpenCode tool-list blink. <!-- oc:id=item_af -->
1. The disabled/uninstalled teardown (Task 6) closes the open panel and the in-flight tool call cleanly. <!-- oc:id=item_ag -->
1. The first-party migration (Task 19) gets a working template for the other 17 panels. <!-- oc:id=item_ah -->

## 5. Implementation template for later built-ins <!-- oc:id=sec_af -->

The shape of this exemplar becomes the template for every other first-party plugin:

- one `panels` entry per logical UI surface the plugin owns
- one `tools` entry per agent-callable business operation
- one `themes` entry only if the plugin ships real theme tokens (most plugins will not)
- commands for `open`, `refresh`, and other reusable user actions
- capabilities kept to the minimum the plugin actually needs; no privilege inheritance from `built-in` tier

A built-in plugin template file at `apps/desktop/.firefly-client/built-in/_template/` will codify this manifest shape so every other plugin starts from the same skeleton.