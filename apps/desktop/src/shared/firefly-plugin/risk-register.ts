/**
 * Firefly Plugin System V2 — Risk register
 *
 * The V2 plan explicitly calls out the following high-severity risks:
 *   - bridge version skew
 *   - React singleton drift
 *   - crash loops
 *   - permission fatigue
 *   - theme precedence bugs
 *   - attached-server ambiguity
 *
 * This file encodes every high-severity risk as a typed record with
 * mitigation, fallback, detection, and defer options so the
 * register is not buried in prose.
 */

import { z } from "zod"

export const riskSeveritySchema = z.enum(["critical", "high", "medium", "low"])
export type RiskSeverity = z.infer<typeof riskSeveritySchema>

export const riskCategorySchema = z.enum([
	"technical",
	"trust",
	"runtime",
	"ui",
	"scope",
])
export type RiskCategory = z.infer<typeof riskCategorySchema>

export const riskEntrySchema = z
	.object({
		id: z.string().min(1).max(80),
		title: z.string().min(1).max(200),
		severity: riskSeveritySchema,
		category: riskCategorySchema,
		description: z.string().min(1).max(600),
		mitigation: z.string().min(1).max(600),
		fallback: z.string().min(1).max(600),
		detection: z.string().min(1).max(600),
		deferOption: z.string().max(600).optional(),
	})
	.strict()
export type RiskEntry = z.infer<typeof riskEntrySchema>

/**
 * The locked V2 risk register. Every high-severity entry has a
 * mitigation and a fallback (the V2 plan acceptance criterion).
 * Critical risks are flagged in the V2 plan must-have; medium
 * and low are tracked but deferrable.
 */
export const V2_RISK_REGISTER: readonly RiskEntry[] = [
	{
		id: "R-bridge-version-skew",
		title: "Bridge version skew (V2 manifest vs running OpenCode server)",
		severity: "high",
		category: "technical",
		description:
			"V2 manifest declares an `engines.opencode` minimum, but the host might be attached to an older or newer server. Mismatched capabilities could silently corrupt tool calls or skip migrations.",
		mitigation:
			"api-versioning.ts enforces `engines.opencode` floor; bridge-projection.ts refuses to project V2 tools when the server reports a lower version; surface an operator-readable 'incompatible' state.",
		fallback:
			"Fall back to the existing first-party-only tool set and disable plugin-to-server calls until the host can re-attach to a compatible server.",
		detection:
			"bridge-projection.test.ts covers managed-only, attached-too-old, attached-too-new, and offline; runtime reports `bridge_unsupported_server`.",
	},
	{
		id: "R-react-singleton-drift",
		title: "React singleton drift (host React vs plugin-pinned React)",
		severity: "high",
		category: "ui",
		description:
			"A third-party plugin might bundle its own React copy and render into the host DOM. Two React copies share no scheduler, no context, no transitions.",
		mitigation:
			"renderer-projection.ts enforces host-owned DOM; host provides React, plugins only emit VNode-like descriptors; runtime checks for any detected second React instance and refuses to load the plugin.",
		fallback:
			"Quarantine the plugin, mark `quarantineStatus: 'security'`, and require operator review before release.",
		detection:
			"Runtime `globalThis.React` version-pin check at activation; first crash is auto-quarantined with `quarantineStatus: 'auto'`.",
	},
	{
		id: "R-crash-loops",
		title: "Crash loops (plugin crashes during activation or hot-reload)",
		severity: "high",
		category: "runtime",
		description:
			"A misbehaving plugin could crash on activation and trigger hot-reload repeatedly, denying CPU to the host.",
		mitigation:
			"runtime-supervision.ts enforces a per-plugin crash counter; after N crashes in T minutes, the plugin is moved to `quarantined` state with `quarantineStatus: 'auto'`.",
		fallback:
			"Operator can `release-quarantine` after review; or `uninstall` (third-party only; built-ins require an update).",
		detection:
			"Per-plugin crash counter, telemetry event `plugin.crash`, and operator row `lastCrash` field shows the latest reason and timestamp.",
	},
	{
		id: "R-permission-fatigue",
		title: "Permission fatigue (operator clicks 'allow always' on every grant)",
		severity: "high",
		category: "trust",
		description:
			"If the operator UI shows a grant prompt for every capability request, operators will rubber-stamp grants. This silently expands trust beyond what the plugin actually needs.",
		mitigation:
			"capabilities.ts deny-by-default; `review-permissions` is a required operator action; `availableOperatorActions` always includes `review-permissions` and `view-logs`; grants are visible per-session.",
		fallback:
			"`quarantine` is always available as a one-click operator action; quarantine halts the plugin's tool calls and surfaces a review prompt.",
		detection:
			"operator-surface test `availableOperatorActions: review-permissions and view-logs are always present`; telemetry tracks grant-vs-prompt ratio per plugin.",
	},
	{
		id: "R-theme-precedence-bugs",
		title: "Theme precedence bugs (preview mutates applied state, user-pick ignored)",
		severity: "high",
		category: "ui",
		description:
			"A plugin theme could 'preview' itself by mutating the applied theme, leaving the user with an unexpected theme after a session. Or the user-pick could be silently overridden by a higher-priority source.",
		mitigation:
			"theme-pipeline.ts precedence: user-pick > active-plugin > imported > bundled; preview NEVER mutates applied state; if userPick matches a non-user-pick candidate, the synthesised winner still has `source: 'user-pick'`.",
		fallback:
			"`THEME_PREVIEW_PLACEHOLDER_ID = 'default'` for missing previews; the operator surface `appliedThemeOwnership` field shows the current applied theme's owner.",
		detection:
			"theme-pipeline.test.ts covers every (userPick, activePlugin, imported, bundled) combination; lint forbids `theme.preview.apply`.",
	},
	{
		id: "R-attached-server-ambiguity",
		title: "Attached-server ambiguity (which server is V2 projecting to?)",
		severity: "high",
		category: "runtime",
		description:
			"The host might be 'managed' (own OpenCode server) or 'attached' (user-supplied server via mDNS / URL). Tool projection must clearly distinguish these modes and refuse to project V2 tools that the attached server does not support.",
		mitigation:
			"bridge-projection.ts has a server-mode matrix: `managed-only`, `attached-too-old`, `attached-too-new`, `offline`, `reconnect`; each mode declares which V2 tools are projected.",
		fallback:
			"Operator row shows `activeServerMode` and `lastError`; plugin tools are hidden from the agent while the host is in an unsupported mode.",
		detection:
			"bridge-projection.test.ts covers every mode; telemetry event `bridge.mode.changed`.",
	},
	{
		id: "R-vsix-runtime-shim",
		title: "Hidden VS Code runtime shim (sneaking vscode.d.ts into runtime)",
		severity: "critical",
		category: "scope",
		description:
			"vscode-import.ts classifies VS Code compatibility as 4-tier. A future contributor could add a 'green' path that bundles vscode.d.ts into the runtime, recreating VS Code's extension host.",
		mitigation:
			"vscode-import.ts source contract: `runtimeShim = false`, `hiddenSidecar = false`; only transpile-only is permitted; vscode.d.ts is a semantic contract, not a runtime dependency.",
		fallback:
			"Reject the import at the V2 manifest boundary; if any plugin tries to `require('vscode')` at runtime, the broker denies it.",
		detection:
			"vscode-import.test.ts locks `runtimeShim === false` and `hiddenSidecar === false`; lint forbids `import * as vscode from 'vscode'` outside of build-time transpilation.",
	},
	{
		id: "R-marketplace-creep",
		title: "Marketplace creep (operator UI grows into a marketplace product)",
		severity: "high",
		category: "scope",
		description:
			"The operator surface is supposed to be lifecycle + inventory. A future contributor could add 'browse', 'discover', or 'install from store' tabs, expanding V2 scope into marketplace product.",
		mitigation:
			"operator-surface.ts has 10 scope flags: `includesMarketplaceBrowse / Discover / Ranking / Purchase` are all `false` and locked in source.",
		fallback:
			"operator-surface.test.ts `OPERATOR_SCOPE keeps marketplace OUT` locks the four flags to `false`; CI breaks if any flag is changed.",
		detection:
			"operator-surface.test.ts has 4 explicit asserts on the marketplace flags; test failure blocks merge.",
	},
	{
		id: "R-storage-collision",
		title: "Storage scope collision (two plugins writing to the same key)",
		severity: "medium",
		category: "runtime",
		description:
			"Two plugins might both request a capability like `storage.global` and trample each other's keys. This is silent data loss.",
		mitigation:
			"storage-scopes.ts namespaces every key by `pluginId`; broker prefixes `plugin.<pluginId>.` to every storage key before delegating to the host.",
		fallback:
			"Operator can view storage usage per plugin from the operator surface; `uninstall` archives storage before deletion.",
		detection:
			"storage-scopes.test.ts covers the `plugin.<id>.` prefix invariant; telemetry tracks storage usage per plugin id.",
	},
	{
		id: "R-palot-bridge-shadow",
		title: "palot-bridge running in shadow alongside V2 path",
		severity: "medium",
		category: "scope",
		description:
			"palot-bridge is a runtime file in `apps/desktop/src/main/palot-plugin/plugin.js`. If V2 lands a manifest for it but the old bridge code keeps running, the host could have two parallel tool sources.",
		mitigation:
			"palot-bridge-manifest.ts is the V2 exemplar; bridge-migration.ts covers every legacy call site with a disposition; the V2 path is the ONLY runtime path for plugins (first-party uses the SAME path).",
		fallback:
			"Behind a feature flag in M3; production rollout is deferred to a later ship.",
		detection:
			"bridge-migration.test.ts locks every row's disposition; runtime logs a warning if both paths are simultaneously active.",
	},
	{
		id: "R-AI-cost-attribution",
		title: "AI / tool cost attribution is untracked",
		severity: "high",
		category: "trust",
		description:
			"A plugin could invoke AI through the broker with no per-plugin cost attribution. The user pays the bill with no visibility into which plugin drove the spend.",
		mitigation:
			"perf-quotas.ts: per-plugin AI/tool metering is a required gate in M9; every broker-mediated AI/tool call carries a `pluginId` tag in the telemetry envelope.",
		fallback:
			"Quotas abort runaway plugins before they affect the host; operator can view per-plugin AI spend in the operator surface.",
		detection:
			"perf-quotas.test.ts locks the metering invariant; telemetry event `plugin.ai.call` carries `pluginId` and `cost`.",
	},
	{
		id: "R-telemetry-overrun",
		title: "Telemetry event fan-out overruns the host",
		severity: "medium",
		category: "runtime",
		description:
			"A chatty plugin could emit thousands of telemetry events per second, overwhelming the host's event loop.",
		mitigation:
			"perf-quotas.ts: per-plugin event rate limit (default 100 events/sec); broker drops events above the limit with a counter.",
		fallback:
			"Operator can lower the rate limit per plugin from the operator surface; quarantine is one click away.",
		detection:
			"Telemetry tracks `plugin.telemetry.dropped` count; operator row exposes the counter.",
	},
] as const

/**
 * Returns all high-severity risks. The V2 plan acceptance criterion
 * requires that every high-severity risk has a mitigation and a
 * fallback; this helper is used by the F1 / F4 audit gate.
 */
export function highSeverityRisks(register: readonly RiskEntry[] = V2_RISK_REGISTER): readonly RiskEntry[] {
	return register.filter((r) => r.severity === "high" || r.severity === "critical")
}
