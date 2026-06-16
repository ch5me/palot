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
 */

import { lookupCapability, type CapabilityRisk } from "../../shared/firefly-plugin/capabilities"
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
	scope: GrantScope
	scopeId: string | null
	consentedCapabilities?: readonly string[]
}): CapabilityGrantRecord[] {
	const consented = new Set(input.consentedCapabilities ?? [])
	const records: CapabilityGrantRecord[] = []

	for (const item of input.plan.autoGrant) {
		records.push({
			pluginId: input.pluginId,
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
