/**
 * Firefly Plugin Marketplace — capability consent model (P3d UI, renderer)
 *
 * Pure helpers that turn a list of capability tokens an extension declares into
 * a human-readable, risk-ordered consent model the install dialog renders.
 * Deny-by-default: nothing is pre-selected; the user explicitly opts in.
 *
 * Risk + identity come from the shared capability catalog so the UI never
 * re-encodes the taxonomy (one source of truth).
 */

import { lookupCapability, type CapabilityRisk } from "../../shared/firefly-plugin/capabilities"

export interface ConsentItem {
	readonly capability: string
	readonly risk: CapabilityRisk
	readonly knownToHost: boolean
	readonly description: string
}

const RISK_RANK: Readonly<Record<CapabilityRisk, number>> = { critical: 0, high: 1, medium: 2, low: 3 }

const GROUP_BLURB: Readonly<Record<string, string>> = {
	fs: "Filesystem",
	net: "Network",
	shell: "Shell / process execution",
	clipboard: "Clipboard",
	ai: "AI model invocation",
	host: "Host integration",
}

/** A short human description for a capability token, derived from the catalog. */
export function describeCapability(token: string): string {
	const cls = lookupCapability(token)
	if (!cls) return `Unknown capability "${token}" (not recognized by this host)`
	const group = GROUP_BLURB[cls.group] ?? cls.group
	return `${group}: ${cls.verb.replace(/[.-]/gu, " ")}`
}

/**
 * Build the consent model: dedupe, classify by risk, order most-dangerous first.
 */
export function buildConsentItems(capabilities: readonly string[]): ConsentItem[] {
	const seen = new Set<string>()
	const items: ConsentItem[] = []
	for (const token of capabilities) {
		if (seen.has(token)) continue
		seen.add(token)
		const cls = lookupCapability(token)
		items.push({
			capability: token,
			risk: cls?.risk ?? "critical",
			knownToHost: cls !== null,
			description: describeCapability(token),
		})
	}
	return items.sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk] || a.capability.localeCompare(b.capability))
}

/** Deny-by-default: the initial approved selection is always empty. */
export function defaultApprovedSelection(): readonly string[] {
	return []
}
