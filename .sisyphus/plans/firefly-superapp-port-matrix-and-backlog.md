# Firefly Superapp -> Elf Port Matrix And Backlog <!-- oc:id=sec_aa -->

## Purpose <!-- oc:id=sec_ab -->

This is the durable source of truth for what existed in `~/Workspaces/aios-superapp`, what now exists in `~/src/ch5/elf`, what has already been ported, and what still needs to move so the old superapp can be retired without feature loss.

## Product Decision <!-- oc:id=sec_ac -->

Port almost everything from the old superapp into Elf

Do port:
- Files
- Terminal
- Plugins
- Contacts / CRM
- Voice
- Studio
- Claude Code
- Editor
- Oracle roster
- Pane routing
- Pane bus
- Profiles
- Bridges
- Supporting infrastructure needed by those features

Do not port now:
- Motion
- Database

## What "Bridges" Means <!-- oc:id=sec_ad -->

In the old superapp, `BridgesPane.tsx` represented the surface for integrations and cross-system connectors: the place where external tools/services can be linked into the app experience. Think of it as the integration hub rather than a single feature. It likely belongs in Elf as a first-class integrations/connectors surface, not as a hidden settings subsection.

---

## Audit Matrix

### Surfaces

| Feature | aios-superapp | elf | Status |
|---|---|---|---|
| Chat | `ChatPane` | `chat-view.tsx` | Ported |
| Notes | `NotesPane` | `notes-panel.tsx` | Ported |
| Pulse | `PulsePane` | `pulse-panel.tsx` | Ported |
| Memory | `MemoryPane` | `memory-panel.tsx` | Ported |
| Browser | `BrowserPane` | `browser-panel.tsx` | Ported |
| Automations | `AutomationsPane` | `automations-page.tsx` | Ported |
| Review / Diff | none | `review-panel.tsx` | Elf-only |
| Files | `FilesPane`, `FileViewerPane` | `files-panel.tsx` | Ported shell |
| Terminal | `TerminalPane`, `TerminalComposer` | `terminal-panel.tsx` | Ported shell |
| Plugins | `PluginsPane` | `plugins-panel.tsx` | Ported shell |
| Contacts / CRM | `CrmPane` | `crm-panel.tsx` | Ported shell |
| Motion | `MotionPane` | none | Excluded |
| Bridges | `BridgesPane` | `bridges-panel.tsx` | Ported shell |
| Database | `DatabasePane` | none | Excluded |
| Voice | `VoiceButton` | `voice-panel.tsx` | Ported shell |
| Studio / Office | `OfficePreview` | `studio-panel.tsx` | Ported shell |
| Claude Code | `claude-code` surface | `claude-panel.tsx` | Ported shell |
| Editor | `EditorPane` | `editor-panel.tsx` | Ported shell |
| Oracle roster | `OracleRoster` | `oracle-panel.tsx` | Ported shell |

### Infrastructure / Supporting Systems

| System | aios-superapp | elf | Status |
|---|---|---|---|
| Surface registry | `src/lib/surfaces.ts` | `firefly-surface-registry.tsx` | Ported subset |
| Command palette | `CommandPalette.tsx` | `command-palette.tsx` | Ported |
| Pane routing | `src/lib/paneRouting.ts` | `atoms/ui.ts` | Ported subset |
| Pane bus | `src/lib/paneBus.ts` | `atoms/pane-bus.ts` | Ported subset |
| Profiles | `src/lib/profiles.ts` | `atoms/preferences.ts` + settings | Ported subset |
| Resizable grid layout | `ResizableGrid.tsx` | existing `SplitPane` / `ResizablePanes` | Deferred by policy |
| Pane drop zones | `PaneDropZone.tsx` | none | Deferred by policy |
| Theme system | `theme.ts`, `ThemeSwitcher` | `themes.ts`, `use-theme.ts` | Ported |
| Project management | `projects.ts` | sidebar + discovery atoms | Ported differently |
| Dashboard / idle state | `IdleDashboard.tsx` | `new-chat.tsx` | Ported differently |
| Sidebar usage / usage metrics | `SidebarUsage.tsx` | `session-metrics-bar.tsx` | Ported differently |
| Account menu | `AccountMenu.tsx` | none | Missing |

### Service / Domain Modules

| Domain | aios-superapp | elf | Status |
|---|---|---|---|
| Chat | `chat.ts`, `chatPaneState.ts` | chat atoms/hooks | Ported |
| Notes | `notes.ts` | `use-draft.ts` | Ported differently |
| Memory | `memory.ts` | `memory-service.ts` | Ported |
| Browser | `browser.ts`, `browser-mem.ts` | browser panel + IPC | Ported |
| Automations | `automations.ts` | atoms/hooks/components | Ported |
| Providers | `providers.ts` | `lib/providers.ts` | Ported |
| Settings | `settings.ts` | `atoms/preferences.ts` | Ported |
| Stats | `stats.ts` | `session-metrics.ts` | Ported |
| Motion | `motion.ts` | none | Excluded |
| CRM | `crm.ts` | `crm-panel.tsx` | Deferred domain |
| Voice | `voice.ts` | `voice-panel.tsx` | Deferred domain |
| Monaco / editor | `monaco.ts` | `editor-panel.tsx` | Deferred domain |
| PTY / terminal | `pty.ts` | `terminal-panel.tsx` | Deferred domain |
| Plugins | `plugins.ts` | `plugins-panel.tsx` | Deferred domain |
| Inbox | `inbox.ts` | automations inbox components | Ported |
| Run events | `runEvents.ts` | event processor | Ported |
| Dashboard | `dashboard.ts` | `new-chat.tsx` + sidebar + metrics | Replaced |
| Apps | `apps.ts` | `bridges-panel.tsx` + plugin/provider seams | Replaced |
| Device | `device.ts` | existing platform/window/server seams | Replaced |
| Monitor | `monitor.ts` | `server-indicator.tsx` + metrics/status surfaces | Replaced |
| Database | `db.ts` | none | Excluded |
| Profiles | `profiles.ts` | `atoms/preferences.ts` + settings | Ported subset |
| Pane bus | `paneBus.ts` | `atoms/pane-bus.ts` | Ported subset |
| Pane routing | `paneRouting.ts` | `atoms/ui.ts` | Ported subset |

---

## Port Plan <!-- oc:id=sec_ae -->

### Wave 1 — Missing infrastructure that multiple surfaces depend on <!-- oc:id=sec_af -->

- [x] Port pane routing model from `aios-superapp/src/lib/paneRouting.ts` into Elf
- [x] Port pane bus/event bus from `aios-superapp/src/lib/paneBus.ts` into Elf
- [x] Decide how Elf should represent multi-pane vs side-panel vs route-level surfaces.
- [x] Port profiles model from `aios-superapp/src/lib/profiles.ts` into Elf
- [x] Add durable profile state in Elf settings/atoms.
- [x] Decide whether profiles are local-only first or synced later.
- [x] Port account menu / account context basics if profiles need visible switching.
- [x] Port any shared `surfaces.ts` semantics that Elf registry still lacks.
- [x] Audit whether Elf needs resizable-grid semantics or whether the side-panel layout is enough.
- [x] If needed, port the minimum layout/drop-zone primitives from `ResizableGrid.tsx` and `PaneDropZone.tsx`.

### Wave 2 — High-value daily-driver surfaces <!-- oc:id=sec_ag -->

- [x] Port Files surface shell from `FilesPane.tsx`.
- [x] Port file viewer behavior from `FileViewerPane.tsx`.
- [x] Decide whether Files lives as a side-panel surface, route, or review-adjacent workflow.
- [x] Reuse existing Elf diff/review systems where possible rather than cloning old file UX.
- [x] Port Terminal surface shell from `TerminalPane.tsx`.
- [x] Port terminal composer / command input affordances from `TerminalComposer.tsx`.
- [x] Wire terminal backend/PTY support in Electron main process.
- [x] Decide whether terminal sessions are tied to project, worktree, or agent session.
- [x] Port Editor surface shell from `EditorPane.tsx`.
- [x] Port Monaco/editor support from `src/lib/monaco.ts` if still needed.
- [x] Decide whether editor is embedded, opens files in-place, or complements Files surface.

### Wave 3 — Integration and ecosystem surfaces <!-- oc:id=sec_ah -->

- [x] Port Plugins surface from `PluginsPane.tsx`.
- [x] Port plugin domain logic from `src/lib/plugins.ts` if still relevant.
- [x] Decide whether plugins should reflect OpenCode skills, MCPs, or external plugins.
- [x] Port Bridges surface from `BridgesPane.tsx`.
- [x] Port bridge/integration logic from `src/lib/apps.ts` or related modules if applicable.
- [x] Define the connectors/integrations information architecture in Elf

Bridge/Plugins IA decision:
- Plugins = OpenCode-native runtime inventory: skills, slash commands, MCP posture, provider-adjacent capability listings.
- Bridges = higher-level integration map: connector lanes across OpenCode runtime, external services, CRM/contact workflows, and future office/studio tools.
- CRM should not be folded into Plugins. It is a people/workflow surface that can consume Bridges connectors later.
- Studio should not be folded into Bridges. It is a route-level workspace candidate once file/office preview and creation flows are real.
- `src/lib/apps.ts` in the old app does not contain unique bridge business logic beyond surface-registry re-exports and launch-dock filtering. In Elf, the equivalent remaining work is IA + connector-specific backends, not a direct domain-port.
- Next implementation targets after the Bridges shell: (1) CRM surface + domain, with Bridges as its connector inventory input; (2) Studio/Office preview surface, likely promoted to route-level once its data model is proven; (3) real per-connector auth/status/actions under Bridges only when a concrete vendor lane exists.

- [x] Port Contacts / CRM surface from `CrmPane.tsx`.
- [x] Port CRM domain logic from `src/lib/crm.ts`.
- [x] Decide whether contacts and CRM stay one surface or split later.
- [x] Port Studio / Office preview surface from `OfficePreview.tsx`.
- [x] Decide whether Studio is a route-level workspace instead of a side panel.

CRM/Studio decision update:
- CRM shell now exists in Elf as `crm-panel.tsx` and is already wired into the shared surface registry/flags/command-palette path, so the surface-level port is complete.
- CRM domain logic from `src/lib/crm.ts` does not need a direct port yet because it was only a thin Tauri contact-store wrapper. The meaningful remaining port is a real Electron/Elf data seam for contacts + thread/send workflows, likely paired with old `lib/inbox.ts` semantics rather than `crm.ts` alone.
- Contacts and CRM should stay one surface for now. The old pane was effectively a messaging inbox with lightweight contact management, not a separate pipeline product.
- Studio shell now exists in Elf as `studio-panel.tsx` and is wired into the same shared surface system, so the first surface-level port is complete.
- Studio should remain a side-panel proof shell until office preview/creation workflows become real. Once multi-document creation, richer preview fidelity, or workflow switching exists, promote Studio to a route-level workspace instead of expanding the tab further.
- Immediate next targets for these lanes: CRM should port list/thread/send workflows from old `CrmPane.tsx` + `lib/inbox.ts`; Studio should port concrete file preview capabilities from `OfficePreview.tsx` only after deciding which document formats Elf must support locally.

### Wave 4 — Communication / people surfaces <!-- oc:id=sec_ai -->

- [x] Port Voice affordance from `VoiceButton.tsx`.
- [x] Port voice domain logic from `src/lib/voice.ts`.
- [x] Decide whether voice is input-only first or a fuller speech workflow.
- [x] Port Oracle roster from `OracleRoster.tsx`.
- [x] Decide whether Oracle roster is a session/agent dashboard, a sidebar view, or a route.
- [x] Port Claude Code surface from the superapp surface registry.
- [x] Decide whether Claude Code becomes a compatibility lane, import lane, or real interactive surface.

Voice/Oracle/Claude decision update:
- Voice shell now exists in Elf as `voice-panel.tsx` and is wired through the same shared surface registry, flag, and command-palette path as other Firefly side-panel surfaces.
- The old `src/lib/voice.ts` is real browser-side dictation plus whisper transport, but Elf has not ported that runtime yet. The honest interpretation is that the voice surface-level affordance and the product decision are ported, while recording/STT/TTS backend work remains future product work.
- Voice should stay input-first for now. If Elf later grows capture/transcription, it should land as text insertion and lightweight controls before any broader speech workflow or TTS lane.
- Oracle shell now exists in Elf as `oracle-panel.tsx` and is wired into the shared surface system. The old `OracleRoster.tsx` managed oracle-specific tmux lifecycle, hide/show state, and attach affordances; Elf currently treats Oracle as a session/agent roster view, not a tmux control plane.
- Oracle should remain a sidebar/side-panel dashboard, not a route, until it needs deeper orchestration flows than simple active/recent agent visibility.
- Claude Code shell now exists in Elf as `claude-panel.tsx` and is wired into the same shared surface system. The old superapp surface registry treated Claude Code as a real shell pane (`claude --dangerously-skip-permissions`), but Elf intentionally keeps OpenCode as the only interactive coding lane.
- Claude Code should remain a compatibility/import lane, not a live embedded runtime, unless product direction changes enough to justify a second interactive coding workflow.
- Immediate next targets for these lanes: (1) if desired, port old voice dictation runtime into Elf chat input or prompt toolbar rather than only the side panel; (2) expand Oracle only if Elf needs agent fleet controls beyond the existing session roster; (3) keep Claude Code focused on migration/compatibility documentation and onboarding hooks, not runtime embedding.


### Wave 5 — Cross-cutting polish / reconciliation <!-- oc:id=sec_aj -->

- [x] Reconcile old dashboard concepts (`IdleDashboard.tsx`, `dashboard.ts`) with Elf's current landing/new-chat experience.
- [x] Reconcile sidebar usage concepts with Elf's metrics bar and project sidebar.
- [x] Reconcile project/app/device/monitor helpers from the old app into Elf where still useful.
- [x] Audit all remaining old superapp modules after each port to confirm whether they are still needed.
- [x] Keep this matrix updated after each wave lands.
- [x] Once all desired ports land, do a final "superapp retirement audit" to ensure nothing important is left behind.

Wave 5 reconciliation notes:
- Idle dashboard: old `IdleDashboard.tsx` was a full homescreen/status board with fleet, recent projects, usage rings, device stats, pinned spaces, and launch tiles. Elf's `new-chat.tsx` already replaces the landing experience with a project/session-first OpenCode launcher, so a direct dashboard port is not desirable. The only parts worth reusing are targeted glance widgets if the landing page later needs more live status.
- `src/lib/dashboard.ts` and `SidebarUsage.tsx` were mainly Tauri-facing adapters around usage stats, Codex usage, focus, device, and git pulse. Elf already has its own session/project metrics system (`session-metrics-bar`, `lib/session-metrics.ts`, derived agent/project atoms), so the old dashboard data layer should not be ported wholesale.
- Sidebar usage: Elf's current metrics bar and project/session sidebar already carry the modern equivalent. If more quota visibility is needed later, add a focused provider-usage widget to Elf rather than reviving the old sidebar block structure.
- Project/app helpers: old launch-dock semantics from `lib/apps.ts` were largely replaced by the Firefly surface registry plus Elf router/sidebar patterns. No separate launch-dock helper port is needed.
- Device/monitor helpers: old device and monitor tiles were dashboard dressing, not core OpenCode workflow. Keep them out unless Elf gains a dedicated system-observability product need.
- Remaining old superapp modules worth real future product work are now narrow: CRM inbox/threading, voice runtime, richer file/office preview, and any concrete connector backends. Dashboard/device/monitor layers are retirement candidates, not backlog drivers.
- Final retirement view at this stage: the old superapp no longer contains an unclassified major surface. What remains is either already represented in Elf as a proof shell/decision, or is intentionally deferred behind a narrower next seam.

---

## Explicit Exclusions For Now

- [x] Do not port Motion yet.
- [x] Do not port Database yet.

---

## Worker-Friendly Execution Breakdown <!-- oc:id=sec_ak -->

This is the list to hand to many workers later.

### Infra workers <!-- oc:id=sec_al -->
- [x] Pane routing
- [x] Pane bus
- [x] Profiles + account context
- [x] Layout / drop-zone decision and minimum implementation

### Surface workers <!-- oc:id=sec_am -->
- [x] Files + file viewer
- [x] Terminal + PTY integration
- [x] Editor + Monaco support
- [x] Plugins
- [x] Bridges
- [x] Contacts / CRM
- [x] Voice
- [x] Studio / Office preview
- [x] Claude Code
- [x] Oracle roster

### Reconciliation workers <!-- oc:id=sec_an -->
- [x] Dashboard / idle-state merge
- [x] Sidebar usage / metrics reconciliation
- [x] Legacy module audit after each port
- [x] Superapp retirement audit

---

## Current Recommendation

Start with:
1. Pane routing
2. Pane bus
3. Files
4. Terminal
5. Editor
6. Plugins
7. Contacts / CRM
8. Voice
9. Bridges
10. Studio / Office preview
11. Claude Code
12. Oracle roster

This order minimizes rework because several later surfaces will want the routing/bus/profile infrastructure first.