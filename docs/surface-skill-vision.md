# Surface Skill Vision

## Short version

Palot already has most pieces of a VS Code-like agent UI platform:

- skills as portable agent instructions with optional files/scripts
- Firefly plugin manifests as typed contribution records
- GenUI/Loom components as typed React-rendered UI
- OpenCode bridge tools as agent-callable control plane
- side panels, widgets, commands, themes, and components as host-projected surfaces

Missing standard: one artifact that lets a skill declare its UI, tools, events,
permissions, and context injection contract without becoming a bespoke app.

Recommended name: **Surface Skill**.

A Surface Skill is a normal skill plus a declarative surface manifest. The skill
teaches the agent what to do. The surface manifest tells the host what UI the
skill can show, what tools it can expose, what events it wants, what capabilities
it needs, and what compact context it injects when active.

## Why this fits this repo

Existing repo evidence points same way:

- `docs/loom-alignment-assessment.md` frames the current system as close to Loom:
  typed component registry, render/poll/patch loop, dual state/signal bindings,
  durable artifact identity, and manifest-as-component-contract.
- `docs/loom-implementation-plan.md` defines the runtime shape: TOON on the
  agent boundary, JSON/WebSocket to the renderer, `render` / `patch` / `poll`,
  node ids, revisions, dirty fields, and component version pinning.
- `apps/desktop/src/shared/firefly-plugin/manifest.ts` already has
  `contributes.components` with props, events, state, `supports_append`,
  capability gates, host vocabulary, and conflict policy.
- `apps/desktop/src/renderer/genui/registry.ts` already models built-in GenUI
  components as Zod-backed entries with props/events/state.
- `apps/desktop/src/main/palot-runtime/` already has Loom runtime primitives:
  session store, dirty field tracking, persistence, bindings, and TOON helpers.
- `.sisyphus/plans/firefly-plugin-system-v2.md` already says plugin
  contributions should be single source of truth for UI and agent/runtime
  behavior, with OpenCode tools derived from the same object.
- `.sisyphus/plans/sidebars-as-first-class-plugins.md` already states the next
  migration goal: first-party sidebars become first-class plugins, while host
  chrome remains host-owned.

So this is not a new architecture. It is a naming and packaging layer over work
already underway.

## Core idea

Current skill:

```text
my-skill/
  SKILL.md
  scripts/
  assets/
```

Surface Skill:

```text
my-surface-skill/
  SKILL.md
  skill.surface.json
  components/
  tools/
  scripts/
  webview/
  assets/
  fixtures/
```

`SKILL.md` stays the agent-readable instruction file. It remains Markdown with
front matter and optional supporting files.

`skill.surface.json` is the host-readable contract. It is declarative, typed,
validated, capability-gated, and safe to index before activation.

The host can load the skill without activating UI code. The agent can discover
small summaries first, then ask for full schemas only when needed.

## Manifest shape

Strawman:

```json
{
  "apiVersion": "agent.surface-skill/v1",
  "kind": "SurfaceSkill",
  "id": "com.acme.pr-review",
  "displayName": "PR Review",
  "version": "0.1.0",
  "skill": {
    "entry": "./SKILL.md",
    "activation": ["onSkillUse", "onCommand:pr.review", "onFilePattern:**/*.diff"]
  },
  "trust": "local-dev",
  "capabilities": [
    "host:surface.open",
    "host:component.render",
    "host:component.patch",
    "host:tool.register",
    "workspace:read"
  ],
  "contributes": {
    "components": [],
    "panels": [],
    "widgets": [],
    "commands": [],
    "tools": [],
    "context": [],
    "eventSubscriptions": [],
    "webviews": []
  }
}
```

This should map directly onto Firefly plugin V2 instead of creating a second
manifest family. Surface Skill is packaging vocabulary; Firefly plugin manifest
is host projection vocabulary.

## Contribution families

### Components

Typed React/GenUI/Loom components.

Each component declares:

- `id`
- `apiVersion`
- `category`
- `props` schema
- `events` schema
- `state` schema
- `supports_append`
- `example`
- `capabilityGates`
- `hostVocabulary`
- `conflictPolicy`

This already matches `contributes.components`.

Component modes:

- `host-reconciler`: host-rendered React component, first-party or trusted only
- `declarative`: data-only component tree rendered by host allowlist
- `webview`: sandboxed escape hatch with strict message bridge

Default should be `declarative`. It is safest for AI-authored/community skills.

### Tools

Typed agent-callable operations.

Rules:

- every tool has Zod/JSON Schema args and typed result envelope
- every tool is session-scoped unless declared otherwise
- every tool declares capability requirements
- tool names are namespaced: `skill.<publisher>.<skill>.<verb>`
- discovery is smallest-schema-first: list -> describe -> call
- agent boundary uses TOON for compact structured payloads

Standard tool result envelope:

```json
{
  "status": "completed",
  "data": {},
  "errorCode": null,
  "errorMessage": null,
  "uiHints": [],
  "provenance": {
    "skillId": "com.acme.pr-review",
    "toolId": "skill.acme.pr-review.summarize",
    "scope": "session"
  }
}
```

### Panels and widgets

Panels are larger surfaces, usually side-panel or main-pane.

Widgets are session-scoped small surfaces placed in host zones:

- `above-chat`
- `chat-inline-right`
- future: `artifact-widget`, `loom-tree`

Plugins do not mint arbitrary chrome. Host owns slots and zones.

### Context providers

This is key missing piece for skill activation.

Surface Skill declares compact context snippets it can inject while active:

```json
{
  "id": "active-pr-context",
  "when": ["skillActive", "panelVisible"],
  "scope": "session",
  "budgetTokens": 700,
  "refresh": "onEvent",
  "summaryTool": "skill.acme.pr-review.context"
}
```

Context must be:

- budgeted
- inspectable
- sourced from host/plugin state, not arbitrary hidden prose
- omitted unless active, visible, or explicitly requested
- smallest-context-first, with handles for deeper fetches

Good injected context shape:

```text
<surface-skill id="com.acme.pr-review">
active: true
panel: pr-review
current_diff_artifact: art_01HX...
available_tools: summarize, mark_file_reviewed, open_review_panel
next_best_action: call summarize with artifact_id if user asks for review status
</surface-skill>
```

### Event subscriptions

Surface Skills subscribe to typed host events:

- `session.started`
- `session.idle`
- `message.created`
- `tool.called`
- `artifact.created`
- `artifact.updated`
- `panel.opened`
- `panel.closed`
- `component.event`
- `component.state_delta`
- `mcp.connection.changed`
- `workspace.file.changed`

Subscriptions are declarative and capability-gated:

```json
{
  "event": "artifact.updated",
  "filter": { "component": "dag-sparkline" },
  "handler": "skill.acme.pr-review.onArtifactUpdated",
  "delivery": "queued"
}
```

Handlers run in plugin worker or host broker, never in Electron main directly.

## Agent/UI loop

Standard loop:

1. Agent activates skill or host detects activation event.
2. Host loads manifest, grants capabilities, starts worker only if needed.
3. Host injects compact context block into active chat.
4. Agent discovers components/tools with `list`.
5. Agent asks `describe` only for needed component/tool.
6. Agent calls `render` to open component tree or panel.
7. Human edits UI locally.
8. UI sends `state_delta` for local fields and `event` for signals.
9. Agent calls `poll` to observe events/state.
10. Agent calls `patch` or `append` to update UI.
11. Host enforces revisions, dirty fields, conflict policy, and capability gates.

This preserves what makes skills good: procedural agent guidance stays text-first.
It adds missing web-native loop: interactive, persistent, inspectable UI.

## Capability model

Deny by default.

Core capability families:

- `host:surface.open`
- `host:surface.close`
- `host:component.render`
- `host:component.patch`
- `host:component.poll`
- `host:webview.create`
- `host:tool.register`
- `host:command.register`
- `host:context.inject`
- `host:event.subscribe`
- `workspace:read`
- `workspace:write`
- `network:fetch`
- `shell:run`
- `mcp:call`
- `secret:read`

Trust tiers:

- `built-in`: host-owned, can use host-reconciler
- `local-dev`: user-authored/local, can use host-reconciler after explicit grant
- `third-party`: declarative or webview by default
- `ai-authored`: declarative only unless promoted

No plugin code runs in Electron main. Main validates, brokers, supervises, and
persists. Renderer renders host-approved UI. Worker runs plugin logic.

## WebView escape hatch

WebView is allowed, but not default.

A webview skill must declare:

- URL or local bundle
- sandbox attributes
- allowed origins
- postMessage schema
- storage scope
- network capability
- clipboard/file permissions
- teardown policy

The webview can hook into chat only by emitting standard frames:

- `event`
- `state_delta`
- `tool_request`
- `context_update`
- `artifact_reference`

No private bridge. No raw DOM access to host chrome.

## Community component registry

The dream should split into two registries:

1. **Component registry**
   - open-source React components
   - schemas, examples, tests, screenshots
   - host compatibility matrix
   - no agent instructions required

2. **Surface Skill registry**
   - skills that compose components, tools, context, events
   - Markdown instructions plus manifest
   - can depend on component packages

This lets component authors build clean UI primitives without writing agent
behavior, and skill authors wire those components into useful workflows.

## Naming

Recommended public vocabulary:

- **Surface Skill**: skill plus UI/tool/event/context contract
- **Surface Pack**: package with one or more Surface Skills/components
- **Loom**: runtime protocol for render/patch/poll/state/event
- **GenUI Component**: typed component usable in chat/artifacts/Loom trees
- **Firefly Plugin**: host/runtime projection of a Surface Skill inside Palot

Other names considered:

- `Loom Skill`: good internal alignment, but less obvious to outside developers
- `Agent UI Pack`: clear, but loses continuity with skills
- `Skill Capsule`: portable, but too abstract
- `Extension`: familiar, but too VS Code-shaped and too broad

`Surface Skill` wins because it says exactly what changed: the skill now owns a
surface, not only instructions.

## First vertical slice

Build one Surface Skill that proves every seam:

`examples/surface-skills/pr-review/`

It contributes:

- `SKILL.md` with review procedure
- `skill.surface.json`
- one side panel: review checklist
- one component: `review_file_card`
- two tools: `summarize_diff`, `mark_file_reviewed`
- one context provider: current diff/review state
- two event subscriptions: `artifact.updated`, `panel.opened`
- one fixture transcript

Acceptance:

- agent can discover the skill
- agent can inspect component/tool schema
- agent can open the panel
- human can mark files reviewed locally
- agent can poll state delta
- agent can patch checklist state
- context injection appears only while panel/skill is active
- disabling the skill removes tools, panel, context, and event handlers

## Strategic take

This is the next step after MCP/CLI/skills:

- MCP gave agents external tools.
- CLIs gave agents deterministic local actions.
- Skills gave agents reusable procedural knowledge.
- Surface Skills give agents durable interactive software.

The standard should not make every skill a mini app. It should let the 10% of
skills that need rich interaction declare UI safely, compactly, and portably.

End state: community ships open components and Surface Skills. Agent hosts load
them safely. Agents stay text-native, but can leave behind real interfaces:
review panels, decision cards, dashboards, inspectors, artifact editors, setup
wizards, and live workbenches.
