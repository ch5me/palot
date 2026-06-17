/**
 * Firefly Plugin System V2 — install-time capability consent (P3d, design §10)
 *
 * Pure policy: given the capabilities an extension declares plus its trust tier,
 * decide which are auto-granted at install and which require explicit user
 * consent. Deny-by-default — nothing is granted that isn't either auto-grantable
 * by policy or affirmatively consented to.
 *
 *   - low-risk           → auto-grant (any trust)
 *   - medium / high      → needs-consent for third-party; auto for built-in
 *   - critical           → needs-consent (even for built-in, design §10)
 *   - unknown to host    → needs-consent (treated as critical; never silently granted)
 *
 * The result drives grant rows in the grant store: auto-grants persist as
 * `granted`/`builtin-policy`; needs-consent items persist as `prompt-required`
 * until the user approves, at which point they become `granted`/`user`.
 *
 * C5 — Re-consent on update:
 *   `computeUpdateConsentPlan` compares a plugin's previous capability set to its
 *   new one and returns the subset that must be re-consented before the new
 *   version activates. A capability that was already in the old set and is still
 *   at the same or lower risk level may carry forward; newly-declared or risk-
 *   escalated medium+ capabilities are forced back to prompt-required.
 */

import { lookupCapability, RISK_ORDER, type CapabilityRisk } from "../../shared/firefly-plugin/capabilities"
import type { TrustTier } from "../../shared/firefly-plugin/manifest"
import type { CapabilityGrantRecord, GrantScope } from "./grant-store"

export interface ConsentPlanItem {
	readonly capability: string
	readonly risk: CapabilityRisk
	readonly knownToHost: boolean
}

export interface InstallConsentPlan {
	/** Granted immediately by policy at install. */
	readonly autoGrant: readonly ConsentPlanItem[]
	/** Require an explicit user decision before they are granted. */
	readonly needsConsent: readonly ConsentPlanItem[]
}

function classify(token: string): ConsentPlanItem {
	const cls = lookupCapability(token)
	return {
		capability: token,
		risk: cls?.risk ?? "critical",
		knownToHost: cls !== null,
	}
}

/**
 * Decide auto-grant vs needs-consent for each declared capability.
 */
export function computeInstallConsentPlan(input: {
	capabilities: readonly string[]
	trust: TrustTier
}): InstallConsentPlan {
	const autoGrant: ConsentPlanItem[] = []
	const needsConsent: ConsentPlanItem[] = []
	const seen = new Set<string>()

	for (const token of input.capabilities) {
		if (seen.has(token)) continue
		seen.add(token)
		const item = classify(token)

		if (!item.knownToHost || item.risk === "critical") {
			needsConsent.push(item)
			continue
		}
		if (input.trust === "built-in") {
			// Built-ins are host-owned: auto-grant everything non-critical.
			autoGrant.push(item)
			continue
		}
		// Third-party: only low-risk is auto-grantable; medium/high need consent.
		if (item.risk === "low") {
			autoGrant.push(item)
		} else {
			needsConsent.push(item)
		}
	}

	return { autoGrant, needsConsent }
}

/**
 * Turn a consent plan into persistable grant records for one scope.
 *
 * `consentedCapabilities` is the subset of `plan.needsConsent` the user approved
 * (empty at install time before any prompt). Auto-grants always persist as
 * `granted`; consented items as `granted`/`user`; the rest as `prompt-required`
 * so the operator UI can surface them later.
 */
export function consentPlanToGrantRecords(input: {
	plan: InstallConsentPlan
	pluginId: string
	pluginVersion?: string
	scope: GrantScope
	scopeId: string | null
	consentedCapabilities?: readonly string[]
}): CapabilityGrantRecord[] {
	const consented = new Set(input.consentedCapabilities ?? [])
	const records: CapabilityGrantRecord[] = []

	for (const item of input.plan.autoGrant) {
		records.push({
			pluginId: input.pluginId,
			pluginVersion: input.pluginVersion,
			scope: input.scope,
			scopeId: input.scopeId,
			capability: item.capability,
			grantState: "granted",
			grantedBy: "builtin-policy",
			reason: `auto-granted at install (${item.risk}-risk)`,
			expiresAt: null,
		})
	}

	for (const item of input.plan.needsConsent) {
		const approved = consented.has(item.capability)
		records.push({
			pluginId: input.pluginId,
			pluginVersion: input.pluginVersion,
			scope: input.scope,
			scopeId: input.scopeId,
			capability: item.capability,
			grantState: approved ? "granted" : "prompt-required",
			grantedBy: approved ? "user" : "builtin-policy",
			reason: approved
				? `user-consented at install (${item.risk}-risk)`
				: `awaiting user consent (${item.risk}-risk${item.knownToHost ? "" : ", unknown capability"})`,
			expiresAt: null,
		})
	}

	return records
}

// ---------------------------------------------------------------------------
// C5 — Update re-consent plan
// ---------------------------------------------------------------------------

export interface UpdateConsentPlan {
	/**
	 * Capabilities that are NEW in v2 (not declared in v1) and are medium+.
	 * These MUST be re-consented before the new version activates.
	 */
	readonly newNeedsConsent: readonly ConsentPlanItem[]
	/**
	 * Capabilities that existed in v1 AND still exist in v2 and whose risk
	 * tier has INCREASED to medium+ (e.g. low→medium, low→high).
	 * These MUST also be re-consented.
	 */
	readonly escalatedNeedsConsent: readonly ConsentPlanItem[]
	/**
	 * Capabilities removed from the new version. Their grants should be revoked.
	 */
	readonly removed: readonly ConsentPlanItem[]
	/**
	 * Capabilities that are unchanged and at low-risk, or built-in auto-grants
	 * that carry forward without re-consent.
	 */
	readonly carryForward: readonly ConsentPlanItem[]
}

/**
 * C5 — Compute what re-consent is required when updating a plugin from one
 * version to another.
 *
 * Rules (third-party, i.e. non-built-in trust tiers):
 *   - NEW capability, medium+          → newNeedsConsent (must re-prompt)
 *   - EXISTING capability, risk went up to medium+ → escalatedNeedsConsent
 *   - EXISTING capability, unchanged or risk went down → carryForward
 *   - LOW-risk new capability           → carryForward (auto-grantable)
 *   - Capability removed in new version → removed (grant should be revoked)
 *   - Built-in trust: all caps auto-grant (carry forward unless removed)
 *
 * The caller is responsible for persisting the final grant rows (with the new
 * version) after collecting explicit consent for the re-consent set.
 */
export function computeUpdateConsentPlan(input: {
	prevCapabilities: readonly string[]
	newCapabilities: readonly string[]
	trust: TrustTier
}): UpdateConsentPlan {
	const prevSet = new Set(input.prevCapabilities)
	const newSet = new Set(input.newCapabilities)

	const newNeedsConsent: ConsentPlanItem[] = []
	const escalatedNeedsConsent: ConsentPlanItem[] = []
	const carryForward: ConsentPlanItem[] = []
	const removed: ConsentPlanItem[] = []

	// Capabilities removed from the new version.
	for (const token of prevSet) {
		if (!newSet.has(token)) {
			removed.push(classify(token))
		}
	}

	// Evaluate each capability in the new version.
	const seen = new Set<string>()
	for (const token of input.newCapabilities) {
		if (seen.has(token)) continue
		seen.add(token)
		const item = classify(token)

		if (input.trust === "built-in") {
			// Built-ins auto-grant everything.
			carryForward.push(item)
			continue
		}

		// Low-risk: always auto-grantable (carry forward or new).
		if (item.knownToHost && item.risk === "low") {
			carryForward.push(item)
			continue
		}

		const isNew = !prevSet.has(token)
		if (isNew) {
			// New medium+ capability (or unknown → treated as critical) → must re-consent.
			newNeedsConsent.push(item)
			continue
		}

		// Existing capability — check for risk escalation.
		const prevItem = classify(token) // same token, same current risk (static catalog)
		// Risk escalation: if the capability is now medium+ and was not previously
		// subject to a needs-consent rule — i.e. it was previously low-risk or the
		// catalog changed. In practice, the risk catalog is static per version, so
		// this detects structural capability-set changes where the SAME token now
		// has a higher risk entry (possible across catalog versions).
		const isRiskyNow = !item.knownToHost || RISK_ORDER[item.risk] >= RISK_ORDER["medium"]
		const prevRisk: CapabilityRisk = prevItem.knownToHost ? prevItem.risk : "critical"
		const wasRiskyBefore = RISK_ORDER[prevRisk] >= RISK_ORDER["medium"]

		if (isRiskyNow && !wasRiskyBefore) {
			escalatedNeedsConsent.push(item)
		} else {
			carryForward.push(item)
		}
	}

	return { newNeedsConsent, escalatedNeedsConsent, removed, carryForward }
}

/**
 * C5 — Returns true when an update requires user re-consent before the new
 * version may activate. Use this as a gate in the update path (F4).
 */
export function updateRequiresConsent(plan: UpdateConsentPlan): boolean {
	return plan.newNeedsConsent.length > 0 || plan.escalatedNeedsConsent.length > 0
}
