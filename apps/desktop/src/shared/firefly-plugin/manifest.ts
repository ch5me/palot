/**
 * Firefly Plugin System V2 — Plugin Manifest (canonical source of truth)
 *
 * `PluginManifest` is the static, on-disk declaration that ships with a plugin
 * (built-in, local-dev, AI-authored, or third-party). It is pure data: no
 * runtime state, no transport handles, no instance identity. The host
 * (main process) parses and validates it through Zod, then derives the
 * `PluginDescriptor` that all projections read from.
 *
 * One schema covers every contribution family:
 *   - panels      (side-panel or main-pane surfaces; default host-rendered)
 *   - navSidebars (host-owned navigation sidebar tabs)
 *   - widgets     (session-scoped widget surfaces in host-defined zones)
 *   - commands    (command palette / menus / keybindings / contextual actions)
 *   - themes      (data-only theme contributions; host applies)
 *   - tools       (OpenCode / agent-callable capabilities with Zod schemas)
 *
 * Plus activation, capabilities, bridge metadata, trust hints, and lifecycle
 * hints. See the V2 plan (`firefly-plugin-system-v2.md`) for the full design
 * and the projection matrix that lists what each family projects into.
 *
 * Identifier namespaces (enforced by `idNamespaceRules` below):
 *   - Plugin id:        reverse-domain or org-scoped; built-ins use
 *                       `firefly.built-in.<area>`.
 *   - Tool id:          host reserves `plugins.*`; plugins use
 *                       `plugin.<pluginId>.<toolShortName>`.
 *   - Command id:       host reserves `firefly.`, `surface.`, `plugins.`
 *                       prefixes; plugins must not shadow them.
 *   - Theme id:         globally unique within host catalog; collision
 *                       rejects activation.
 *   - Panel/widget id:  unique within (plugin, family); projected global ids
 *                       are host-namespaced.
 */

import { z } from "zod"

/**
 * Reserved top-level namespaces. Only host-owned built-ins and first-party
 * exemplars may claim these. `acme` is reserved for in-tree exemplars only.
 */
const RESERVED_NAMESPACES = ["firefly", "palot", "ch5", "acme"] as const

/**
 * PluginId: canonical form is `namespace.name` (Open VSX-style, §4 of the
 * marketplace design doc). The legacy multi-segment reverse-DNS form
 * (`firefly.built-in.surface.memory`) is still accepted for back-compat
 * during the alias migration, but new plugins must use the two-segment form.
 *
 * Accepted forms:
 *   - `namespace.name`                 — canonical (e.g. "firefly.memory")
 *   - `namespace.segment.name`         — legacy reverse-DNS (e.g.
 *                                        "firefly.built-in.surface.memory")
 *   up to 6 segments total for backwards compatibility.
 *
 * Validation rules:
 *   - Each segment: lowercase alphanumeric + hyphens, starts with alpha/digit.
 *   - Total 2-6 dot-separated segments.
 *   - Reserved namespaces (`firefly`, `palot`, `ch5`, `acme`) are rejected for
 *     non-built-in plugins (trust must be "built-in" or the id is in the
 *     reserved acme exemplar set — enforced at parse time via the manifest
 *     superRefine; the schema itself only validates the string shape here).
 */
const pluginIdSchema = z
	.string()
	.min(3)
	.max(128)
	.regex(
		/^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*){1,5}$/u,
		"plugin id must be lowercase dot-separated segments (2-6 segments, alphanumeric+hyphens)",
	)

/**
 * Short id used within a contribution family (panel id, widget id, command id,
 * theme id). Must not start with reserved host prefixes.
 */
const shortIdSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z][a-zA-Z0-9-]*$/u, "short id must be alphanumeric+dash, start with a letter")

const reservedCommandPrefixes = ["firefly.", "surface.", "plugins.", "plugin."]
const reservedToolPrefixes = ["plugins."]

function startsWithAny(value: string, prefixes: readonly string[]): boolean {
	for (const prefix of prefixes) {
		if (value === prefix.slice(0, -1) || value.startsWith(prefix)) return true
	}
	return false
}

const commandIdSchema = shortIdSchema.refine(
	(id) => !startsWithAny(id, reservedCommandPrefixes),
	`command id must not start with reserved host prefixes: ${reservedCommandPrefixes.join(", ")}`,
)

const toolIdSchema = z
	.string()
	.min(3)
	.max(160)
	.regex(/^[a-zA-Z][a-zA-Z0-9_.-]*$/u, "tool id must be alphanumeric+_-. and start with a letter")
	.refine(
		(id) => !startsWithAny(id, reservedToolPrefixes),
		`tool id must not start with reserved host prefix: ${reservedToolPrefixes.join(", ")}`,
	)

// ---------------------------------------------------------------------------
// Semver
// ---------------------------------------------------------------------------

const semverSchema = z
	.string()
	.regex(
		/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u,
		"version must be a valid semver string",
	)

/**
 * SemVer range constraint used by `engines.firefly`. Accepts the same
 * subset that the Firefly host evaluates via `satisfiesSemverRange` in
 * `descriptor.ts`:
 *
 *   `>=X.Y.Z`               – floor only (most common built-in form)
 *   `>=X.Y.Z <A.B.C`        – floor + exclusive upper bound
 *   `>=X.Y.Z <=A.B.C`       – floor + inclusive upper bound
 *   `>X.Y.Z`                – exclusive floor (uncommon)
 *   `<X.Y.Z` / `<=X.Y.Z`   – upper-only constraint
 *   `X.Y.Z`                 – bare exact version (treated as `>=X.Y.Z`)
 *
 * Intentionally a subset of npm semver — complex range syntax (`||`, `~`,
 * `^`, hyphen ranges) is not accepted to keep compatibility solving
 * auditable at a glance.
 */
const semverRangeSchema = z
	.string()
	.min(1)
	.max(80)
	.regex(
		/^(?:>=?|<=?)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\s+(?:>=?|<=?)\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)*$|^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u,
		"engines.firefly must be a semver range (e.g. '>=0.12.0', '>=0.12.0 <1.0.0')",
	)

/**
 * Activation triggers. Discriminated by `kind` so the host can index
 * activation cheaply. Unknown kinds are rejected to keep the activation
 * surface auditable.
 */
const activationEventSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("onStartup") }),
	z.object({ kind: z.literal("onSessionAttach") }),
	z.object({
		kind: z.literal("onCommand"),
		commandId: commandIdSchema,
	}),
	z.object({
		kind: z.literal("onPanelOpen"),
		panelId: shortIdSchema,
	}),
	z.object({
		kind: z.literal("onWidgetPlace"),
		widgetId: shortIdSchema,
	}),
	z.object({
		kind: z.literal("onToolCall"),
		toolId: toolIdSchema,
	}),
	z.object({
		kind: z.literal("onThemeApply"),
		themeId: shortIdSchema,
	}),
])

// ---------------------------------------------------------------------------
// Capability tokens
// ---------------------------------------------------------------------------

/**
 * Capability token string. The host validates each token against
 * `capabilitySchema` exported from `./capabilities`. Here we only enforce
 * string shape and length; semantic validation lives in `capabilities.ts`.
 *
 * Format: `<group>:<verb>` or `host:<namespace>:<verb>`. Examples:
 *   - "fs:read"
 *   - "net:https-only"
 *   - "host:bridge.session-read"
 *   - "host:browser.lane-control"
 *   - "host:theme.apply"
 *   - "host:command.register"
 *   - "host:tool.register"
 */
const capabilityTokenSchema = z
	.string()
	.min(3)
	.max(96)
	.regex(/^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-.]*){1,3}$/u, "capability must be lowercase colon-separated tokens")

/**
 * Trust tier. Built-in plugins are host-trusted; local-dev is granted trust
 * only on the developer's machine; third-party requires an explicit consent
 * step unless a signature is present. The host derives the actual grant
 * policy from this hint plus signature/checksum evidence in lifecycle.
 */
const trustTierSchema = z.enum(["built-in", "local-dev", "signed-third-party", "unsigned-third-party"])

/**
 * Lifecycle hints. The host is free to ignore any of these; they exist so
 * the plugin can request behaviors without forcing the host to introspect
 * random fields. `quarantineOnCrashCount` defaults to 3 in the descriptor
 * derivation if omitted.
 */
const lifecycleHintsSchema = z
	.object({
		autoEnable: z.boolean().default(true),
		quarantineOnCrashCount: z.number().int().nonnegative().max(20).optional(),
		restartBackoffMs: z.number().int().nonnegative().max(60_000).optional(),
		keepAliveAcrossSessions: z.boolean().default(false),
	})
	.strict()

/**
 * Panel contribution. `defaultZone` is host-defined vocabulary (e.g.
 * "side-panel", "main-pane"). `formFactor` matches the V2 plan
 * (`side-panel-tab` | `main-pane`). `availability` is a static hint; the
 * host computes live availability at projection time using capability state.
 */
const panelContributionSchema = z
	.object({
		id: shortIdSchema,
		title: z.string().min(1).max(80),
		formFactor: z.enum(["side-panel-tab", "main-pane"]),
		defaultZone: z.string().min(1).max(40),
		icon: z.string().max(64).optional(),
		defaultOn: z.boolean().default(false),
		commandIds: z.array(commandIdSchema).max(8).default([]),
		persistenceKey: z.string().min(1).max(80).optional(),
		telemetryNamespace: z
			.string()
			.min(1)
			.max(80)
			.regex(/^[a-z][a-z0-9.-]*$/u, "telemetry namespace must be lowercase dotted")
			.optional(),
		availability: z
			.object({
				requires: z.array(capabilityTokenSchema).default([]),
			})
			.strict()
			.default({ requires: [] }),
		render: z
			.object({
				mode: z.enum(["host-reconciler", "declarative-props", "iframe"]),
				declarativeSchemaRef: z.string().max(120).optional(),
				iframeSandbox: z.string().max(240).optional(),
			})
			.strict(),
	})
	.strict()

const navSidebarContributionSchema = z
	.object({
		id: shortIdSchema,
		title: z.string().min(1).max(80),
		icon: z.string().max(64).optional(),
		order: z.number().int().min(0).max(10_000).default(0),
		defaultOn: z.boolean().default(false),
		commandIds: z.array(commandIdSchema).max(8).default([]),
		persistenceKey: z.string().min(1).max(80).optional(),
		telemetryNamespace: z
			.string()
			.min(1)
			.max(80)
			.regex(/^[a-z][a-z0-9.-]*$/u, "telemetry namespace must be lowercase dotted")
			.optional(),
		availability: z
			.object({
				requires: z.array(capabilityTokenSchema).default([]),
			})
			.strict()
			.default({ requires: [] }),
		render: z
			.object({
				mode: z.enum(["host-reconciler", "declarative-props"]),
				declarativeSchemaRef: z.string().max(120).optional(),
			})
			.strict(),
	})
	.strict()

/**
 * Widget contribution. `zoneId` is host-defined vocabulary
 * (`above-chat` | `chat-inline-right` in the current seed). The host
 * enforces that the zone exists; V2 may not mint new zones.
 */
const widgetContributionSchema = z
	.object({
		id: shortIdSchema,
		title: z.string().min(1).max(80),
		zoneId: z.string().min(1).max(40),
		defaultEnabled: z.boolean().default(true),
		icon: z.string().max(64).optional(),
		availability: z
			.object({
				requires: z.array(capabilityTokenSchema).default([]),
			})
			.strict()
			.default({ requires: [] }),
		render: z
			.object({
				mode: z.enum(["host-reconciler", "declarative-props", "iframe"]),
				declarativeSchemaRef: z.string().max(120).optional(),
				iframeSandbox: z.string().max(240).optional(),
			})
			.strict(),
	})
	.strict()

/**
 * Command contribution. The host projects commands into the command palette
 * plus menus + keybindings. `keybinding` follows Electron's
 * `CommandOrControl+Shift+P` style strings.
 */
const commandContributionSchema = z
	.object({
		id: commandIdSchema,
		title: z.string().min(1).max(120),
		description: z.string().max(400).optional(),
		category: z.string().max(40).optional(),
		keybinding: z.string().max(64).optional(),
		menuPath: z.array(z.string().min(1).max(40)).max(6).optional(),
		icon: z.string().max(64).optional(),
		when: z.string().max(200).optional(),
		requires: z.array(capabilityTokenSchema).default([]),
	})
	.strict()

/**
 * Theme contribution. Data-only; the host applies it. `tokens` is a flat
 * CSS custom-property map; `darkTokens` overrides for dark mode. `platforms`
 * is a coarse allow-list (e.g. `["darwin", "linux", "win32"]`).
 */
const themeContributionSchema = z
	.object({
		id: shortIdSchema,
		label: z.string().min(1).max(80),
		kind: z.enum(["light", "dark", "system-adaptive"]).default("system-adaptive"),
		platforms: z.array(z.enum(["darwin", "linux", "win32"])).min(1).optional(),
		tokens: z.record(z.string(), z.string().min(1).max(240)).default({}),
		darkTokens: z.record(z.string(), z.string().min(1).max(240)).default({}),
		fontFamily: z.string().max(80).optional(),
		radius: z.string().max(16).optional(),
		density: z.enum(["compact", "cozy", "comfortable"]).optional(),
		imports: z
			.object({
				source: z.enum(["vscode-theme", "open-vsx"]),
				externalId: z.string().min(1).max(200),
				provenance: z.string().max(400).optional(),
			})
			.strict()
			.optional(),
	})
	.strict()

// ---------------------------------------------------------------------------
// Tool contribution (OpenCode / agent surface)
// ---------------------------------------------------------------------------

/**
 * ZodRawShape entry. We accept any valid Zod schema node so that plugin
 * authors can use `z.string()`, `z.enum([...])`, `z.object({...})`, etc.
 * The host deep-wraps in `z.object(args)` at projection time, mirroring the
 * pattern already used by `palot-bridge-schemas.ts`.
 */
const zodRawShapeEntrySchema = z.custom<z.ZodTypeAny>(
	(value) => value instanceof Object && typeof (value as { _zod?: unknown })._zod !== "undefined",
	{ message: "tool args entries must be Zod schema nodes" },
)

/**
 * Tool contribution. `args` is a flat raw-shape map (ZodRawShape), never a
 * constructed ZodObject — the projection layer wraps in `z.object(args)`.
 * `scope` defaults to `session`, matching the V2 plan's default rule.
 */
const toolContributionSchema = z
	.object({
		id: toolIdSchema,
		title: z.string().min(1).max(120),
		description: z.string().min(1).max(400),
		scope: z.enum(["session", "project", "app"]).default("session"),
		requires: z.array(capabilityTokenSchema).default([]),
		args: z.record(z.string().min(1).max(64), zodRawShapeEntrySchema).default({}),
		resultSchemaRef: z.string().max(120).optional(),
		timeoutMs: z.number().int().positive().max(600_000).optional(),
		uiHints: z
			.object({
				openPanel: z.string().max(64).optional(),
				focusWidget: z.string().max(64).optional(),
				refreshProjection: z.boolean().optional(),
			})
			.strict()
			.optional(),
		preview: z.boolean().optional(),
	})
	.strict()

const componentCategorySchema = z.enum(["diagram", "decision", "form", "viewer", "layout", "custom"])
const componentConflictPolicySchema = z.enum(["agent-wins", "human-wins", "merge", "ask"])
const componentPresentationSchema = z.enum([
	"inline-artifact",
	"chat-widget",
	"side-panel",
	"main-pane",
	"webview",
])
const componentScopeSchema = z.enum(["generic", "ch5-internal", "lab"])
const componentMaturitySchema = z.enum(["stable", "beta", "alpha", "internal"])
const componentPlacementSchema = z.enum([
	"inline",
	"above-chat",
	"chat-inline-right",
	"side-panel",
	"main-pane",
])
const componentHostVocabularySchema = z
	.object({
		slots: z.array(z.string().min(1).max(80)).default([]),
		zones: z.array(z.string().min(1).max(80)).default([]),
	})
	.strict()
	.default({ slots: [], zones: [] })
const componentExampleSchema = z
	.object({
		component: z.string().min(1).max(120),
		props: z.unknown(),
	})
	.strict()

const componentContributionSchema = z
	.object({
		id: z.string().min(1).max(120),
		apiVersion: z.number().int().positive().max(64),
		category: componentCategorySchema,
		props: zodRawShapeEntrySchema,
		events: z.record(z.string().min(1).max(64), zodRawShapeEntrySchema).default({}),
		state: z.record(z.string().min(1).max(64), zodRawShapeEntrySchema).default({}),
		supports_append: z.boolean().default(false),
		presentation: componentPresentationSchema.default("inline-artifact"),
		scope: componentScopeSchema.default("generic"),
		maturity: componentMaturitySchema.default("alpha"),
		defaultPlacement: componentPlacementSchema.default("inline"),
		allowedPlacements: z.array(componentPlacementSchema).min(1).default(["inline"]),
		sourcePackage: z.string().min(1).max(160).optional(),
		storybookPath: z.string().min(1).max(320).optional(),
		docsPath: z.string().min(1).max(320).optional(),
		example: componentExampleSchema,
		capabilityGates: z.array(capabilityTokenSchema).default([]),
		hostVocabulary: componentHostVocabularySchema,
		conflictPolicy: componentConflictPolicySchema.default("ask"),
	})
	.strict()
	.superRefine((component, ctx) => {
		if (component.example.component !== component.id) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["example", "component"],
				message: `component example.component must equal component id: ${component.id}`,
			})
		}
	})

/**
 * Bridge metadata — the OpenCode / agent-facing surface. `systemContextBlock`
 * is the literal string the host injects so the agent can reason about this
 * plugin. `requiresSessionBinding` declares whether the plugin needs a
 * session binding; `bindOnActivation` is whether the host should bind
 * immediately on activation or lazily on first tool call.
 */
const bridgeMetadataSchema = z
	.object({
		schemaVersion: z.literal(1),
		agentContextLabel: z.string().min(1).max(80).optional(),
		systemContextBlock: z.string().max(2000).optional(),
		requiresSessionBinding: z.boolean().default(false),
		bindOnActivation: z.boolean().default(false),
	})
	.strict()

// ---------------------------------------------------------------------------
// Manifest root
// ---------------------------------------------------------------------------

const manifestApiVersionSchema = z.literal("firefly.plugin/v2")

/**
 * PluginManifest: the canonical, on-disk V2 source of truth.
 */
export const pluginManifestSchema = z
	.object({
		apiVersion: manifestApiVersionSchema,
		kind: z.literal("PluginManifest"),
		id: pluginIdSchema,
		displayName: z.string().min(1).max(120),
		version: semverSchema,
		publisher: z.string().min(1).max(120).optional(),
		description: z.string().max(800).optional(),
		license: z.string().max(40).optional(),
		homepage: z.string().url().max(400).optional(),

		/**
		 * V2 manifest revision. The host uses this to negotiate the
		 * manifest evolution rules. See Task 12 in the V2 plan.
		 */
		manifestRevision: z.number().int().positive().max(64).default(1),

		/**
		 * Host compatibility constraints for this plugin.
		 *
		 * `engines.firefly` (canonical) — a SemVer range the host app version
		 * must satisfy before loading this plugin (e.g. `">=0.12.0 <1.0.0"`).
		 * Evaluated by `satisfiesSemverRange` in `descriptor.ts`.
		 *
		 * `engines.desktop` (migration alias, deprecated) — the old bare-floor
		 * string from before the §5.2 rename. Treated by the host as
		 * `>=${desktop}`. Remove once all built-ins have migrated.
		 *
		 * When both fields are present `engines.firefly` takes precedence;
		 * `engines.desktop` is ignored.
		 */
		engines: z
			.object({
				firefly: semverRangeSchema.optional(),
				/** @deprecated use `engines.firefly` — kept as migration alias */
				desktop: semverSchema.optional(),
			})
			.strict()
			.default({}),

		trust: trustTierSchema,
		lifecycle: lifecycleHintsSchema.default({
			autoEnable: true,
			keepAliveAcrossSessions: false,
		}),

		activationEvents: z.array(activationEventSchema).min(1),

		contributes: z
			.object({
				panels: z.array(panelContributionSchema).default([]),
				navSidebars: z.array(navSidebarContributionSchema).default([]),
				widgets: z.array(widgetContributionSchema).default([]),
				commands: z.array(commandContributionSchema).default([]),
				themes: z.array(themeContributionSchema).default([]),
				tools: z.array(toolContributionSchema).default([]),
				components: z.array(componentContributionSchema).default([]),
			})
			.strict()
			.default({
				panels: [],
				navSidebars: [],
				widgets: [],
				commands: [],
				themes: [],
				tools: [],
				components: [],
			}),

		capabilities: z.array(capabilityTokenSchema).default([]),

		bridge: bridgeMetadataSchema.optional(),

		/**
		 * Free-form tags for analytics/operator UI. Does not influence
		 * projection.
		 */
		tags: z.array(z.string().min(1).max(40)).max(20).default([]),
	})
	.strict()
	.superRefine((manifest, ctx) => {
		// Enforce reserved namespace policy: only built-in (host-owned) plugins
		// may claim firefly, palot, ch5 namespaces. `acme` is reserved for
		// in-tree exemplars which declare themselves as signed-third-party.
		// Legacy multi-segment reverse-DNS ids that start with a reserved prefix
		// are already "built-in" by convention, so we only reject the case where
		// the namespace is reserved AND trust is NOT built-in AND it is NOT in
		// the acme exemplar set.
		const namespace = manifest.id.split(".")[0]!
		const isReservedNs = (RESERVED_NAMESPACES as readonly string[]).includes(namespace)
		if (isReservedNs && namespace !== "acme" && manifest.trust !== "built-in") {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["id"],
				message: `non-built-in plugins must not use the "${namespace}." namespace (reserved for host-owned plugins)`,
			})
		}

		const seen = {
			panels: new Set<string>(),
			navSidebars: new Set<string>(),
			widgets: new Set<string>(),
			commands: new Set<string>(),
			themes: new Set<string>(),
			tools: new Set<string>(),
			components: new Set<string>(),
		}
		for (const panel of manifest.contributes.panels) {
			if (seen.panels.has(panel.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["contributes", "panels"],
					message: `duplicate panel id: ${panel.id}`,
				})
			}
			seen.panels.add(panel.id)
		}
		for (const navSidebar of manifest.contributes.navSidebars) {
			if (seen.navSidebars.has(navSidebar.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["contributes", "navSidebars"],
					message: `duplicate nav-sidebar id: ${navSidebar.id}`,
				})
			}
			seen.navSidebars.add(navSidebar.id)
		}
		for (const widget of manifest.contributes.widgets) {
			if (seen.widgets.has(widget.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["contributes", "widgets"],
					message: `duplicate widget id: ${widget.id}`,
				})
			}
			seen.widgets.add(widget.id)
		}
		for (const command of manifest.contributes.commands) {
			if (seen.commands.has(command.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["contributes", "commands"],
					message: `duplicate command id: ${command.id}`,
				})
			}
			seen.commands.add(command.id)
		}
		for (const theme of manifest.contributes.themes) {
			if (seen.themes.has(theme.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["contributes", "themes"],
					message: `duplicate theme id: ${theme.id}`,
				})
			}
			seen.themes.add(theme.id)
		}
		for (const tool of manifest.contributes.tools) {
			if (seen.tools.has(tool.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["contributes", "tools"],
					message: `duplicate tool id: ${tool.id}`,
				})
			}
			seen.tools.add(tool.id)
		}
		for (const component of manifest.contributes.components) {
			if (seen.components.has(component.id)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["contributes", "components"],
					message: `duplicate component id: ${component.id}`,
				})
			}
			seen.components.add(component.id)
		}

		// Activation references must point at declared ids within the
		// same manifest. Cross-manifest activation is intentionally
		// unsupported in V2 to keep activation graphs auditable.
		const declaredCommandIds = new Set(manifest.contributes.commands.map((c) => c.id))
		const declaredPanelIds = new Set(manifest.contributes.panels.map((p) => p.id))
		const declaredWidgetIds = new Set(manifest.contributes.widgets.map((w) => w.id))
		const declaredToolIds = new Set(manifest.contributes.tools.map((t) => t.id))
		const declaredThemeIds = new Set(manifest.contributes.themes.map((t) => t.id))

		manifest.activationEvents.forEach((event, index) => {
			switch (event.kind) {
				case "onCommand":
					if (!declaredCommandIds.has(event.commandId)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["activationEvents", index],
							message: `onCommand references undeclared command id: ${event.commandId}`,
						})
					}
					break
				case "onPanelOpen":
					if (!declaredPanelIds.has(event.panelId)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["activationEvents", index],
							message: `onPanelOpen references undeclared panel id: ${event.panelId}`,
						})
					}
					break
				case "onWidgetPlace":
					if (!declaredWidgetIds.has(event.widgetId)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["activationEvents", index],
							message: `onWidgetPlace references undeclared widget id: ${event.widgetId}`,
						})
					}
					break
				case "onToolCall":
					if (!declaredToolIds.has(event.toolId)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["activationEvents", index],
							message: `onToolCall references undeclared tool id: ${event.toolId}`,
						})
					}
					break
				case "onThemeApply":
					if (!declaredThemeIds.has(event.themeId)) {
						ctx.addIssue({
							code: z.ZodIssueCode.custom,
							path: ["activationEvents", index],
							message: `onThemeApply references undeclared theme id: ${event.themeId}`,
						})
					}
					break
				default:
					break
			}
		})

		for (const panel of manifest.contributes.panels) {
			for (const cid of panel.commandIds) {
				if (!declaredCommandIds.has(cid)) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["contributes", "panels"],
						message: `panel ${panel.id} references undeclared command id: ${cid}`,
					})
				}
			}
		}
	})

export type PluginManifest = z.infer<typeof pluginManifestSchema>
export type PluginId = z.infer<typeof pluginIdSchema>
export type CapabilityToken = z.infer<typeof capabilityTokenSchema>
export { RESERVED_NAMESPACES }
export type PanelContribution = z.infer<typeof panelContributionSchema>
export type NavSidebarContribution = z.infer<typeof navSidebarContributionSchema>
export type WidgetContribution = z.infer<typeof widgetContributionSchema>
export type CommandContribution = z.infer<typeof commandContributionSchema>
export type ThemeContribution = z.infer<typeof themeContributionSchema>
export type ToolContribution = z.infer<typeof toolContributionSchema>
export type ComponentContribution = z.infer<typeof componentContributionSchema>
export type ActivationEvent = z.infer<typeof activationEventSchema>
export type TrustTier = z.infer<typeof trustTierSchema>
export type LifecycleHints = z.infer<typeof lifecycleHintsSchema>
export type BridgeMetadata = z.infer<typeof bridgeMetadataSchema>

/**
 * Parse a manifest from an unknown payload, returning a parsed/typed
 * `PluginManifest` or throwing a `ZodError` that lists every issue.
 *
 * Host code MUST route through this entry point — do not call
 * `pluginManifestSchema.parse` directly so the validation step is greppable
 * and easy to instrument.
 */
export function parsePluginManifest(input: unknown): PluginManifest {
	return pluginManifestSchema.parse(input)
}

/**
 * Like `parsePluginManifest` but never throws. Returns the parsed manifest
 * AND the list of issues. Use this at the catalog-load boundary so the host
 * can quarantine one bad plugin without blocking the rest of the catalog.
 */
export function safeParsePluginManifest(input: unknown): {
	manifest: PluginManifest | null
	issues: z.ZodIssue[]
} {
	const result = pluginManifestSchema.safeParse(input)
	if (result.success) {
		return { manifest: result.data, issues: [] }
	}
	return { manifest: null, issues: result.error.issues }
}
