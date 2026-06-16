import { z } from "zod"

import type { PluginManifest } from "../manifest"

export const ACME_COMPONENTS_PLUGIN_ID = "acme.components-showcase" as const

const loyaltyProgressBarPropsSchema = z
	.object({
		label: z.string().min(1).max(80),
		value: z.number().min(0).max(100),
		max: z.number().positive().max(100).default(100),
		tier: z.enum(["bronze", "silver", "gold"]).default("silver"),
		helpText: z.string().max(160).optional(),
	})
	.strict()

const loyaltyProgressBarEventSchema = z
	.object({
		action: z.enum(["view-rewards"]),
	})
	.strict()

const loyaltyProgressBarStateSchema = z
	.object({
		hovered: z.boolean().default(false),
	})
	.strict()

export const acmeComponentsExemplarManifest: PluginManifest = {
	apiVersion: "firefly.plugin/v2",
	kind: "PluginManifest",
	id: ACME_COMPONENTS_PLUGIN_ID,
	displayName: "Acme Components Showcase",
	version: "0.1.0",
	publisher: "Acme Software, Inc.",
	description:
		"Signed third-party exemplar that contributes a Loom component through the V2 manifest contract.",
	license: "Apache-2.0",
	homepage: "https://acme.example.com/components",
	manifestRevision: 1,
	engines: { firefly: ">=0.11.0" },
	trust: "signed-third-party",
	lifecycle: {
		autoEnable: false,
		keepAliveAcrossSessions: false,
		quarantineOnCrashCount: 3,
		restartBackoffMs: 1_000,
	},
	activationEvents: [{ kind: "onStartup" }],
	contributes: {
		panels: [],
		navSidebars: [],
		widgets: [],
		commands: [],
		themes: [],
		tools: [],
		components: [
			{
				id: "acme.loyalty_progress_bar",
				apiVersion: 1,
				category: "custom",
				props: loyaltyProgressBarPropsSchema,
				events: {
					select: loyaltyProgressBarEventSchema,
				},
				state: {
					hovered: loyaltyProgressBarStateSchema,
				},
				supports_append: false,
				presentation: "chat-widget",
				scope: "generic",
				maturity: "alpha",
				defaultPlacement: "chat-inline-right",
				allowedPlacements: ["inline", "chat-inline-right"],
				docsPath: "docs/surface-skill-vision.md",
				example: {
					component: "acme.loyalty_progress_bar",
					props: {
						label: "Loyalty progress",
						value: 72,
						max: 100,
						tier: "gold",
						helpText: "28 points until next reward",
					},
				},
				capabilityGates: ["acme:read"],
				hostVocabulary: {
					slots: ["summary", "meter"],
					zones: ["loom-tree", "artifact-widget"],
				},
				conflictPolicy: "ask",
			},
		],
	},
	capabilities: ["acme:read"],
	bridge: {
		schemaVersion: 1,
		agentContextLabel: "acme-components-showcase",
		systemContextBlock:
			"<acme-components>Use acme.loyalty_progress_bar when the user asks for loyalty progress or rewards status.</acme-components>",
		requiresSessionBinding: true,
		bindOnActivation: false,
	},
	tags: ["third-party", "components", "loom"],
}

export const acmeLoyaltyProgressBarPropsSchema = loyaltyProgressBarPropsSchema
