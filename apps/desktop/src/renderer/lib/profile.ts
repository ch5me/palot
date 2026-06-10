/**
 * Firefly mode preset for a profile (CH5COMPAC4C-304 P4).
 *
 * Modes only change what the chat prompt toolbar reveals; every mode reads
 * the same agent/role registry:
 * - "consumer" — no agent/model/variant pickers; agent resolves to the
 *   server-side default (`main`).
 * - "simple" — a compact Main/Plan toggle instead of the agent dropdown.
 * - "power" — today's full experience (agent dropdown + model + variant).
 * - "custom" — power, plus `visibleAgents` filters the agent dropdown.
 */
export type FireflyMode = "consumer" | "simple" | "power" | "custom"

export const FIREFLY_MODES: FireflyMode[] = ["consumer", "simple", "power", "custom"]

export const FIREFLY_MODE_DESCRIPTIONS: Record<FireflyMode, string> = {
	consumer: "Just chat — agent and model are chosen automatically.",
	simple: "Compact Main/Plan toggle; model is chosen automatically.",
	power: "Full control: agent roster, model picker, and variants.",
	custom: "Power controls, with a per-profile agent allowlist.",
}

export interface FireflyProfile {
	id: string
	label: string
	description?: string
	/** Mode preset. Missing (pre-mode stored profiles) resolves to "simple". */
	mode?: FireflyMode
	/**
	 * Custom-mode allowlist of agent names shown in the agent dropdown.
	 * Empty or undefined = all agents visible.
	 */
	visibleAgents?: string[]
}

export const DEFAULT_FIREFLY_MODE: FireflyMode = "simple"

export function isFireflyMode(value: unknown): value is FireflyMode {
	return value === "consumer" || value === "simple" || value === "power" || value === "custom"
}

/** Resolve a profile's mode, defaulting missing/invalid values to "simple". */
export function resolveFireflyMode(profile: Pick<FireflyProfile, "mode">): FireflyMode {
	return isFireflyMode(profile.mode) ? profile.mode : DEFAULT_FIREFLY_MODE
}

/**
 * Migrate stored profiles to the mode-aware shape: missing or invalid
 * `mode` becomes "simple"; valid modes and all other fields are preserved.
 */
export function migrateFireflyProfile(profile: FireflyProfile): FireflyProfile {
	if (isFireflyMode(profile.mode)) return profile
	return { ...profile, mode: DEFAULT_FIREFLY_MODE }
}

export function normalizeFireflyProfileLabel(label: string): string {
	return label.trim().replace(/\s+/g, " ").slice(0, 32)
}

export const DEFAULT_FIREFLY_PROFILE_ID = "default"

export const DEFAULT_FIREFLY_PROFILE: FireflyProfile = {
	id: DEFAULT_FIREFLY_PROFILE_ID,
	label: "Default",
	description: "Local profile for this device",
	mode: DEFAULT_FIREFLY_MODE,
}

// ============================================================
// Prompt-toolbar mode gating
// ============================================================

/** Agent names the simple-mode Main/Plan toggle switches between. */
export const SIMPLE_MODE_MAIN_AGENT = "main"
export const SIMPLE_MODE_PLAN_AGENT = "plan"

export interface ToolbarGating {
	/**
	 * How the agent control renders:
	 * - "none" — no agent control at all (consumer)
	 * - "main-plan-toggle" — compact two-state Main/Plan toggle (simple)
	 * - "dropdown" — the full agent dropdown (power/custom, simple fallback)
	 */
	agentControl: "none" | "main-plan-toggle" | "dropdown"
	showModelSelector: boolean
	showVariantSelector: boolean
	/**
	 * Agent names to show in the dropdown when `agentControl === "dropdown"`.
	 * Only custom mode filters; everywhere else this echoes the input names.
	 */
	visibleAgentNames: string[]
}

/**
 * Pure gating decision for the chat prompt toolbar.
 *
 * Simple mode degrades gracefully when the `main`/`plan` role agents have
 * not deployed to the server yet: the toggle would be inoperable, so it
 * falls back to today's full experience (dropdown + model + variant).
 */
export function resolveToolbarGating(
	profile: Pick<FireflyProfile, "mode" | "visibleAgents">,
	availableAgentNames: string[],
): ToolbarGating {
	const mode = resolveFireflyMode(profile)

	switch (mode) {
		case "consumer":
			return {
				agentControl: "none",
				showModelSelector: false,
				showVariantSelector: false,
				visibleAgentNames: [],
			}
		case "simple": {
			const hasMainAndPlan =
				availableAgentNames.includes(SIMPLE_MODE_MAIN_AGENT) &&
				availableAgentNames.includes(SIMPLE_MODE_PLAN_AGENT)
			if (hasMainAndPlan) {
				return {
					agentControl: "main-plan-toggle",
					showModelSelector: false,
					showVariantSelector: false,
					visibleAgentNames: [],
				}
			}
			// Deploy lag: main/plan absent from app.agents() — fall back to
			// the current full experience instead of a dead toggle.
			return {
				agentControl: "dropdown",
				showModelSelector: true,
				showVariantSelector: true,
				visibleAgentNames: availableAgentNames,
			}
		}
		case "power":
			return {
				agentControl: "dropdown",
				showModelSelector: true,
				showVariantSelector: true,
				visibleAgentNames: availableAgentNames,
			}
		case "custom": {
			const allowlist = profile.visibleAgents ?? []
			const visibleAgentNames =
				allowlist.length === 0
					? availableAgentNames
					: availableAgentNames.filter((name) => allowlist.includes(name))
			return {
				agentControl: "dropdown",
				showModelSelector: true,
				showVariantSelector: true,
				visibleAgentNames,
			}
		}
	}
}

/**
 * Gate the agent override actually sent with a message, so a selection made
 * under a permissive mode cannot leak through a restrictive one:
 * - "none" (consumer) → null; the server-side default (`main`) applies.
 * - "main-plan-toggle" (simple) → only `main`/`plan` pass; anything else
 *   drops to null (server default).
 * - "dropdown" → passes through unchanged.
 */
export function gateAgentSelection(
	gating: ToolbarGating,
	selectedAgent: string | null,
): string | null {
	switch (gating.agentControl) {
		case "none":
			return null
		case "main-plan-toggle":
			return selectedAgent === SIMPLE_MODE_MAIN_AGENT || selectedAgent === SIMPLE_MODE_PLAN_AGENT
				? selectedAgent
				: null
		case "dropdown":
			return selectedAgent
	}
}
