/**
 * Firefly Plugin System V2 — Capability broker + IPC result envelope
 *
 * The capability broker is a pure deny-by-default gate that the host
 * consults before any plugin tool call is dispatched. It composes the
 * shared `evaluateBrokerRequest` helper with the host-owned grants
 * store so the runtime is the single source of truth for who-can-do-
 * what at every tool-dispatch boundary.
 *
 * `CapabilityDecision` is the host-side payload that flows back to
 * the renderer over IPC. It carries the canonical
 * `(granted, reason, errorCode)` triple that matches the V2 plan's
 * tool result envelope semantics.
 */

import {
	BUILT_IN_DEFAULT_CAPABILITIES,
	evaluateBrokerRequest,
	NEVER_AUTO_GRANT,
	lookupCapability,
} from "../../shared/firefly-plugin/capabilities"
import type { CapabilityRisk, CapabilityToken, PluginId, TrustTier } from "../../shared/firefly-plugin/manifest"
import { createLogger } from "../logger"

const log = createLogger("firefly-plugin/broker")

export type CapabilityDecisionReason =
	| "granted-builtin-baseline"
	| "granted-explicit"
	| "denied-never-auto-grant"
	| "denied-unknown-capability"
	| "denied-third-party-unsigned-medium"
	| "denied-critical-needs-consent"
	| "denied-disabled"

export interface CapabilityDecision {
	readonly pluginId: PluginId
	readonly token: CapabilityToken
	readonly granted: boolean
	readonly reason: string
	readonly reasonCode: CapabilityDecisionReason
	readonly risk: CapabilityRisk
	readonly knownToHost: boolean
	readonly grantedTokens: readonly CapabilityToken[]
}

/**
 * Default baseline grants every built-in plugin starts with. The
 * broker still consults `NEVER_AUTO_GRANT` for tokens that must be
 * explicitly granted even on a built-in plugin. This mirrors the V2
 * plan §10 rule that built-in plugins get the baseline set for free
 * minus high-risk capabilities.
 */
export function builtInBaselineGrants(pluginTrust: TrustTier): readonly CapabilityToken[] {
	if (pluginTrust !== "built-in") return []
	return [...BUILT_IN_DEFAULT_CAPABILITIES]
}

/**
 * Decide whether the host should grant `token` to a plugin for the
 * given scope, consulting the live `grantedTokens` list. Pure (aside
 * from logging) so it can be re-run after a trust change or session
 * rebind without state drift.
 */
export function decideCapability(input: {
	pluginId: PluginId
	trust: TrustTier
	token: CapabilityToken
	sessionScope: "session" | "project" | "app"
	grantedTokens: readonly CapabilityToken[]
	pluginDisabled?: boolean
}): CapabilityDecision {
	if (input.pluginDisabled) {
		return {
			pluginId: input.pluginId,
			token: input.token,
			granted: false,
			reason: "Plugin is disabled",
			reasonCode: "denied-disabled",
			risk: "critical",
			knownToHost: lookupCapability(input.token) !== null,
			grantedTokens: input.grantedTokens,
		}
	}
	const cls = lookupCapability(input.token)
	if (!cls) {
		return {
			pluginId: input.pluginId,
			token: input.token,
			granted: false,
			reason: "Unknown capability token",
			reasonCode: "denied-unknown-capability",
			risk: "critical",
			knownToHost: false,
			grantedTokens: input.grantedTokens,
		}
	}
	const result = evaluateBrokerRequest({
		token: input.token,
		trust: input.trust,
		sessionScope: input.sessionScope,
		grantedTokens: input.grantedTokens,
	})
	const reasonCode: CapabilityDecisionReason = (() => {
		if (result.granted) {
			return input.trust === "built-in" && !NEVER_AUTO_GRANT.includes(input.token as never)
				? "granted-builtin-baseline"
				: "granted-explicit"
		}
		if (result.risk === "critical") return "denied-critical-needs-consent"
		if (input.trust === "unsigned-third-party" && result.risk !== "low")
			return "denied-third-party-unsigned-medium"
		return "denied-never-auto-grant"
	})()
	const decision: CapabilityDecision = {
		pluginId: input.pluginId,
		token: input.token,
		granted: result.granted,
		reason: result.reason,
		reasonCode,
		risk: result.risk,
		knownToHost: true,
		grantedTokens: input.grantedTokens,
	}
	if (!result.granted) {
		log.debug("Broker denied capability", {
			pluginId: input.pluginId,
			token: input.token,
			reasonCode,
		})
	}
	return decision
}

/**
 * Decide whether ALL of the given tokens are granted. This is the
 * helper the dispatcher uses before invoking a plugin tool —
 * requiring every declared token is the V2 deny-by-default rule.
 */
export function decideCapabilityAll(input: {
	pluginId: PluginId
	trust: TrustTier
	tokens: readonly CapabilityToken[]
	sessionScope: "session" | "project" | "app"
	grantedTokens: readonly CapabilityToken[]
	pluginDisabled?: boolean
}): { granted: boolean; failures: readonly CapabilityDecision[] } {
	const failures: CapabilityDecision[] = []
	for (const token of input.tokens) {
		const decision = decideCapability({
			pluginId: input.pluginId,
			trust: input.trust,
			token,
			sessionScope: input.sessionScope,
			grantedTokens: input.grantedTokens,
			pluginDisabled: input.pluginDisabled,
		})
		if (!decision.granted) {
			failures.push(decision)
		}
	}
	return { granted: failures.length === 0, failures }
}

// Re-export so callers can import broker + deny-list from one path.
export { BUILT_IN_DEFAULT_CAPABILITIES, NEVER_AUTO_GRANT, lookupCapability }
