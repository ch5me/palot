# Task 22 — Third-party / AI-authored exemplar plugin vertical slice <!-- oc:id=sec_aa -->

Wave 4, Task 22 of plan `firefly-plugin-system-v2`.
Grounded in prior evidence:
- `task-6-lifecycle-trust.md`
- `task-8-family-contracts.md`
- `task-9-tool-projection.md`
- `task-10-capability-broker.md`
- `task-11-isolation.md`
- `task-13-renderer-projection.md`
- `task-17-commands-projection.md`
- `task-21-native-boundary.md`

---

## 1. Exemplar choice and rationale

### Choice
Use one realistic third-party plugin: **`acme.corp/research-briefing`**.

This plugin represents vendor-authored or AI-assisted workflow extension for research-heavy coding sessions. It adds:
- one side-panel research workspace
- one session widget showing active brief / citations status
- one command for opening or refreshing research context
- one theme tuned for long-form evidence review
- one plugin business tool that fetches, summarizes, and structures public web research for current OpenCode session

### Why this exemplar is good

It spans every V2 surface that matters without cheating on guardrails:

| Concern | How exemplar exercises it |
|---|---|
| Trust tier | Runs as signed third-party plugin under `acme.corp/*` scope, not built-in or local-dev |
| Permissions | Needs `net`, `ai`, `bridge:session-read`, `bridge:session-write`, `host:ui`, `host:commands`, `host:widgets`, `host:themes`, `theme:apply`, `tool:register` |
| UI contribution | Contributes one panel and one widget through host-rendered projection |
| OpenCode tool control | Exposes host-generated wrappers plus one business tool `plugin.acme.corp/research-briefing.generateBrief` |
| Isolation | Worker fetches and summarizes externally; host still owns DOM, persistence, grants, and all privileged mediation |
| Lifecycle | Sensible install -> enable -> activate -> degrade/quarantine path if network, AI calls, or worker health fail |

### Why this is realistic

A research-briefing plugin is plausible for both:
- **third-party vendor**: a company shipping research augmentation for developers
- **AI-authored plugin**: generated from host SDK and constrained manifest, but still reviewed and installed as ordinary package

This matters because V2 must support both human-written and AI-authored plugins through same manifest/runtime path.

### Why this respects V2 non-goals

It avoids every forbidden shortcut:
- no plugin code in main process
- no direct DOM mutation
- no runtime `vscode` shim
- no native Node addon, Rust module, Python sidecar, or arbitrary binary dependency
- no hidden first-party-only API lane
- no unbounded marketplace/discovery design assumption

Everything fits inside browser/network/AI/session/UI surfaces already modeled by V2.

---

## 2. Manifest draft for the exemplar <!-- oc:id=sec_ab -->

```json
{
  "schemaVersion": "2.0.0",
  "id": "acme.corp/research-briefing",
  "version": "1.2.0",
  "displayName": "Research Briefing",
  "publisher": {
    "name": "Acme Corp",
    "homepage": "https://acme.example/plugins/research-briefing",
    "signature": {
      "type": "ed25519",
      "keyId": "acme-release-2026q2"
    }
  },
  "fireflyHost": "^2.0.0",
  "trust": {
    "tierHint": "signed-third-party"
  },
  "activation": {
    "events": [
      "onCommand:plugin.acme.corp/research-briefing.openPanel",
      "onCommand:plugin.acme.corp/research-briefing.refreshBrief",
      "onPanelOpen:research-briefing",
      "onWidgetMount:brief-status",
      "onToolCall:plugin.acme.corp/research-briefing.generateBrief",
      "onThemeApply:acme-research-paper"
    ]
  },
  "capabilities": [
    "fs:plugin",
    "net",
    "ai",
    "host:ui",
    "host:commands",
    "host:widgets",
    "host:themes",
    "theme:apply",
    "bridge:session-read",
    "bridge:session-write",
    "tool:register"
  ],
  "networkDomains": [
    "api.acme.example",
    "search.brave.com",
    "r.jina.ai"
  ],
  "contributes": {
    "panels": [
      {
        "id": "research-briefing",
        "title": "Research Briefing",
        "icon": "newspaper",
        "location": "sidebar-right",
        "surface": "reconciler",
        "entry": "./dist/panels/research-briefing.js#ResearchBriefingPanel",
        "defaultEnabled": true,
        "requiresCapabilities": [
          "host:ui",
          "bridge:session-read"
        ],
        "when": "session.active && plugin.available"
      }
    ],
    "widgets": [
      {
        "id": "brief-status",
        "title": "Brief Status",
        "zoneId": "above-chat",
        "entry": "./dist/widgets/brief-status.js#BriefStatusWidget",
        "defaultEnabled": true,
        "requiresCapabilities": [
          "bridge:session-read"
        ],
        "when": "session.active"
      }
    ],
    "commands": [
      {
        "id": "plugin.acme.corp/research-briefing.openPanel",
        "title": "Open Research Briefing",
        "category": "Research",
        "icon": "panel-right-open",
        "menu": ["palette", "panel-header"],
        "shortcut": "Cmd+Shift+R",
        "when": "session.active",
        "handlerPluginOnly": false,
        "requiresCapabilities": [
          "host:commands",
          "bridge:ui-state-write"
        ]
      },
      {
        "id": "plugin.acme.corp/research-briefing.refreshBrief",
        "title": "Refresh Research Brief",
        "category": "Research",
        "icon": "refresh-cw",
        "menu": ["palette", "panel-header", "context"],
        "when": "session.active",
        "handlerPluginOnly": true,
        "requiresCapabilities": [
          "net",
          "ai",
          "bridge:session-read",
          "bridge:session-write"
        ]
      }
    ],
    "themes": [
      {
        "id": "acme-research-paper",
        "label": "Acme Research Paper",
        "uiTheme": "vs",
        "precedence": 40,
        "dataOnly": true,
        "data": {
          "background": "#f8f4ea",
          "foreground": "#1f1d1a",
          "panel": "#efe7d6",
          "accent": "#a34d2d",
          "muted": "#7a6f62"
        }
      }
    ],
    "tools": [
      {
        "name": "plugin.acme.corp/research-briefing.generateBrief",
        "description": "Fetch public web research and build a cited briefing for current coding session.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "sessionId": { "type": "string" },
            "query": { "type": "string" },
            "maxSources": { "type": "integer", "minimum": 1, "maximum": 8 },
            "mode": {
              "type": "string",
              "enum": ["quick", "deep"]
            }
          },
          "required": ["sessionId", "query"]
        },
        "sessionScope": "session",
        "timeoutMs": 45000,
        "dispatchingCeilingMs": 5000,
        "requiresCapabilities": [
          "net",
          "ai",
          "bridge:session-read",
          "bridge:session-write"
        ],
        "uiHints": {
          "openPanel": "acme.corp/research-briefing/research-briefing",
          "focusWidget": "acme.corp/research-briefing/brief-status",
          "refreshProjection": true
        }
      }
    ]
  },
  "bridge": {
    "schemaVersion": "2.0.0",
    "introspectionLabel": "Research briefing workflow",
    "sessionBinding": "required",
    "contextInjection": {
      "kind": "summary-block",
      "maxChars": 1200,
      "source": "latest-brief"
    }
  }
}
```

### Notes on draft <!-- oc:id=sec_ac -->

- `surface` stays `reconciler`, not `iframe`, because exemplar does not need escape hatch to prove UI path.
- Theme is data-only and app-scoped, matching V2 family contract.
- Commands stay under required `plugin.<pluginId>.*` namespace.
- Business tool declares static superset; runtime may still narrow by session availability.
- No native dependency field, no binary install hook, no Electron-main affordance.

---

## 3. State transitions it exercises

This exemplar covers more than happy path. It proves same plugin can move through lifecycle, capability, and projection transitions without special cases.

### 3.1 Install and trust path

1. `discovered`
   - Host sees package from signed third-party source.
   - `id` fits `<scope>/<name>` rules from Task 6.
2. `validated`
   - Zod parse passes.
   - Host version gate passes.
   - Signature and reserved-namespace checks pass.
   - Capabilities are recognized and policy-legal.
3. `installed`
   - Plugin lands on disk with default-deny grants.
4. `disabled`
   - Third-party posture can require explicit enable after install.

### 3.2 First enable and grant negotiation

5. `activating`
   - Worker starts in plugin host.
   - Host projects placeholder panel/widget definitions.
   - Tool wrappers exist for introspection, but execution waits for active worker.
6. `active`
   - User grants `net`, `ai`, `bridge:session-read`, and `bridge:session-write` at session or project scope.
   - Panel renders latest briefing state.
   - Widget shows `idle`, `running`, or `last updated` status.
   - `plugin.<id>.panel.open`, `plugin.<id>.command.run`, `plugin.<id>.theme.apply`, and `plugin.<id>.generateBrief` all become live.

### 3.3 Session-scoped runtime transitions

7. `session attached`
   - `PluginSessionHandle` created for current OpenCode session.
   - Widget and tool visibility become `available` only for bound session.
8. `session lost`
   - Host marks tool state `unavailable` with `session_lost` / `no_active_server` style envelope.
   - Panel can remain visible but degraded with reconnect messaging.
9. `session resumed`
   - Same descriptor re-projects with new `PluginSessionHandle`; no manifest churn needed.

### 3.4 Capability denial and narrowed availability

10. `denied`
   - Agent calls `plugin.acme.corp/research-briefing.generateBrief` without `net` or `ai` grant.
   - Broker returns canonical `status: "denied"`, `errorCode: "permission_denied"`.
   - Command remains listed, but disabled reason becomes capability-related.
11. `partial grant`
   - User grants `bridge:session-read` but not `bridge:session-write`.
   - Panel can still read prior briefing state.
   - Refresh command and generation tool remain denied.
   - This proves contribution visibility and business execution can diverge safely.

### 3.5 Degraded and quarantine path

12. `degraded`
   - Worker remains alive, but repeated outbound fetch failures or AI upstream timeouts cause health warnings.
   - Renderer shows degraded badge; wrappers still return `failed` or `retryable` envelopes.
13. `quarantined`
   - Repeated crashes, undeclared capability request, or manifest hash mismatch triggers quarantine.
   - Panel and widget disappear from usable projection.
   - Tool wrappers still introspect, but business tools return `unavailable` with quarantine reason.
14. `disabled`
   - Operator clears quarantine; plugin returns to disabled state pending re-enable.
15. `removed`
   - Uninstall revokes grants, closes session handles, removes projections, retains audit history.

### 3.6 Theme lifecycle path

16. `theme listed before activation`
   - Theme contribution is introspectable from descriptor even if worker is not active.
17. `theme apply`
   - `plugin.<id>.theme.apply` succeeds via host-owned adapter with app-scoped semantics.
18. `theme reset`
   - Host removes contribution from active theme stack without needing plugin worker to own CSS or native theme plumbing.

---

## 4. What it proves for the architecture <!-- oc:id=sec_ad -->

### 4.1 One manifest/runtime path is enough <!-- oc:id=sec_ae -->

This exemplar proves first-party-only shortcuts are unnecessary. One `PluginDescriptor` can drive:
- panel projection
- widget projection
- command/menu/keybinding projection
- theme catalog projection
- OpenCode wrapper generation
- plugin business tool registration
- lifecycle UI and operator recovery

No parallel registry needed.

### 4.2 Trust and capability posture are separate from contribution shape <!-- oc:id=sec_af -->

Plugin can declare rich UI and tools, but actual runtime authority still depends on broker grants and lifecycle state. That proves V2 model is not "install means full trust." Descriptor stays declarative; authority stays host-owned.

### 4.3 Session scope works across UI and agent control <!-- oc:id=sec_ag -->

Same session-bound briefing state powers:
- right-side panel for humans
- above-chat widget for quick status
- OpenCode tool invocation for agent workflows
- optional context injection block for model grounding

That proves `PluginSessionHandle` is correct seam for shared session awareness.

### 4.4 Isolation model stays credible under real workload <!-- oc:id=sec_ah -->

Research plugin is intentionally networked and AI-calling, so it is stronger proof than simple theme or static panel example. Even then:
- worker can crash without taking renderer or main with it
- host owns grants, persistence, UI projection, and theme application
- plugin never gets raw DOM or Electron main powers

That proves isolation design is not only for toy plugins.

### 4.5 V2 non-goals still hold under ambitious plugin <!-- oc:id=sec_ai -->

Even fairly capable third-party plugin still does **not** require:
- arbitrary native deps
- runtime VS Code compatibility
- direct renderer mutation
- hidden first-party API
- custom top-level chrome outside host slots

This is important architecture proof: meaningful ecosystem value exists inside V2 guardrails.

### 4.6 Good acceptance-slice coverage <!-- oc:id=sec_aj -->

Against Task 22 acceptance criteria, this exemplar covers:

| Acceptance need | Covered? | Why |
|---|---|---|
| trust | yes | signed third-party install, tiered enablement, quarantine |
| permissions | yes | brokered `net`, `ai`, bridge, theme grants |
| UI | yes | panel + widget + command + theme |
| tools | yes | wrappers plus one business tool |
| isolation | yes | worker-thread execution, host-owned mediation |
| V2 non-goals respected | yes | no native deps, no main-process code, no vscode shim |

## Bottom line <!-- oc:id=sec_ak -->

`acme.corp/research-briefing` is strong exemplar because it is useful, believable, cross-surface, and stressful enough to validate architecture. If V2 can support this plugin cleanly, it can support most third-party and AI-authored productivity plugins without widening scope or breaking guardrails.