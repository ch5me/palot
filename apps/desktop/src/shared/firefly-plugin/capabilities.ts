/**
 * Firefly Plugin System V2 — Capability taxonomy + broker surface
 *
 * Capability tokens are the deny-by-default authority model. A plugin
 * declares the superset it needs in `manifest.capabilities`; the broker
 * refuses any operation whose required token is not granted for the
 * active session.
 *
 * Three capability groups in V2:
 *   - generic primitives:   fs:*, net:*, shell:*, clipboard:*, ai:*
 *   - host surface powers:  host:command.register, host:tool.register
 *   - Firefly-specific:     host:bridge.*, host:browser.*, host:theme.*
 *
 * The taxonomy is intentionally closed in V2. A new capability class
 * must be added here AND in the broker / prompt / manifest tests so the
 * V2 plan's "Firefly-specific capabilities explicitly modeled" must-have
 * stays auditable.
 */

import { z } from "zod"

/**
 * Generic primitive groups. The host is allowed to deny any verb in
 * these groups; the only requirement is that a plugin MUST declare the
 * group+verb in its manifest.
 */
export const PRIMITIVE_CAPABILITIES = {
	"fs:read": { group: "fs", verb: "read", risk: "low" },
	"fs:write": { group: "fs", verb: "write", risk: "high" },
	"net:http": { group: "net", verb: "http", risk: "medium" },
	"net:https-only": { group: "net", verb: "https-only", risk: "low" },
	"shell:exec": { group: "shell", verb: "exec", risk: "critical" },
	"clipboard:read": { group: "clipboard", verb: "read", risk: "medium" },
	"clipboard:write": { group: "clipboard", verb: "write", risk: "medium" },
	"ai:invoke": { group: "ai", verb: "invoke", risk: "medium" },
} as const satisfies Record<string, CapabilityClass>

/**
 * Host-surface powers. These are Firefly-specific powers a plugin
 * needs in order to register host-side contributions. Without these,
 * the projection layer will reject the corresponding manifest field.
 */
export const HOST_CAPABILITIES = {
	"host:command.register": { group: "host", verb: "command.register", risk: "low" },
	"host:tool.register": { group: "host", verb: "tool.register", risk: "low" },
	"host:panel.register": { group: "host", verb: "panel.register", risk: "low" },
	"host:nav-sidebar.register": { group: "host", verb: "nav-sidebar.register", risk: "low" },
	"host:widget.register": { group: "host", verb: "widget.register", risk: "low" },
	"host:theme.register": { group: "host", verb: "theme.register", risk: "low" },
	"host:ui.read": { group: "host", verb: "ui.read", risk: "low" },
	"host:ui.write": { group: "host", verb: "ui.write", risk: "high" },
	"host:bridge.session-read": { group: "host", verb: "bridge.session-read", risk: "medium" },
	"host:bridge.session-write": { group: "host", verb: "bridge.session-write", risk: "high" },
	"host:bridge.ui-state-read": { group: "host", verb: "bridge.ui-state-read", risk: "low" },
	"host:bridge.ui-state-write": { group: "host", verb: "bridge.ui-state-write", risk: "high" },
	"host:browser.lane-control": { group: "host", verb: "browser.lane-control", risk: "high" },
	"host:browser.tab-control": { group: "host", verb: "browser.tab-control", risk: "medium" },
	"host:browser.action-dispatch": { group: "host", verb: "browser.action-dispatch", risk: "high" },
	"host:theme.apply": { group: "host", verb: "theme.apply", risk: "low" },
	"host:theme.preview": { group: "host", verb: "theme.preview", risk: "low" },
	"host:automation.schedule": { group: "host", verb: "automation.schedule", risk: "medium" },
	"host:automation.write": { group: "host", verb: "automation.write", risk: "high" },
	// DevMux dev-service control surface. `read` inspects the project's
	// devmux config + live service health; `control` starts/stops the
	// declared services. Modeled as a scoped host power (the `vscode.tasks`
	// analog) rather than `shell:exec` — the plugin can only act on services
	// the project already declares, never run arbitrary commands. `control`
	// is medium (mirrors host:browser.tab-control: it manages a live local
	// surface) and stays out of NEVER_AUTO_GRANT so built-ins work before the
	// per-session command-consent UX lands; promote to high + NEVER_AUTO_GRANT
	// once that UX exists.
	"host:devmux.read": { group: "host", verb: "devmux.read", risk: "low" },
	"host:devmux.control": { group: "host", verb: "devmux.control", risk: "medium" },
} as const satisfies Record<string, CapabilityClass>

/**
 * The closed V2 capability catalog. Every capability class a plugin can
 * declare must appear here.
 */
export const CAPABILITY_CATALOG = {
	...PRIMITIVE_CAPABILITIES,
	...HOST_CAPABILITIES,
} as const

export type KnownCapabilityToken = keyof typeof CAPABILITY_CATALOG

/**
 * Risk classification. The host uses this to choose between
 * one-tap-grant and explicit-prompt consent. "critical" capabilities
 * always require explicit per-session consent, even for built-in plugins.
 */
export type CapabilityRisk = "low" | "medium" | "high" | "critical"

export interface CapabilityClass {
	readonly group: string
	readonly verb: string
	readonly risk: CapabilityRisk
	readonly description?: string
}

export const capabilityRiskSchema = z.enum(["low", "medium", "high", "critical"])

/**
 * The full set of risk levels a token can carry. The broker uses this to
 * pick the consent UX. Tokens with risk=critical never fall through to
 * one-tap-grant even when the user is the plugin's author.
 */
export const RISK_ORDER: Readonly<Record<CapabilityRisk, number>> = {
	low: 0,
	medium: 1,
	high: 2,
	critical: 3,
}

/**
 * Default capability set for a built-in plugin. Built-ins are still
 * deny-by-default; this is the *baseline* set, not an auto-grant. The
 * user can still revoke individual tokens through the operator UI.
 */
export const BUILT_IN_DEFAULT_CAPABILITIES: readonly KnownCapabilityToken[] = [
	"host:command.register",
	"host:tool.register",
	"host:panel.register",
	"host:nav-sidebar.register",
	"host:widget.register",
	"host:theme.register",
	"host:ui.read",
	"host:bridge.session-read",
	"host:bridge.ui-state-read",
	"host:theme.preview",
	"host:devmux.read",
	"host:devmux.control",
]

/**
 * Capabilities a built-in plugin NEVER gets without explicit per-session
 * consent. These are listed so the broker can short-circuit the
 * one-tap-grant path for them.
 */
export const NEVER_AUTO_GRANT: readonly KnownCapabilityToken[] = [
	"fs:write",
	"net:http",
	"shell:exec",
	"clipboard:read",
	"clipboard:write",
	"host:ui.write",
	"host:bridge.session-write",
	"host:bridge.ui-state-write",
	"host:browser.lane-control",
	"host:browser.action-dispatch",
	"host:automation.write",
	"ai:invoke",
]

/**
 * Look up the class metadata for a capability token, or `null` if the
 * token is unknown to the host (and therefore the plugin is asking for
 * something the V2 host does not grant).
 */
export function lookupCapability(token: string): CapabilityClass | null {
	if (Object.hasOwn(CAPABILITY_CATALOG, token)) {
		return CAPABILITY_CATALOG[token as KnownCapabilityToken]
	}
	return null
}

export function isKnownCapability(token: string): token is KnownCapabilityToken {
	return Object.hasOwn(CAPABILITY_CATALOG, token)
}

export interface BrokerDecision {
	granted: boolean
	reason: string
	risk: CapabilityRisk
}

/**
 * Pure broker decision: would the host grant `token` to a plugin of
 * `trust` for the active `sessionScope`?
 *
 * This is intentionally side-effect-free so the broker can be re-run
 * after a trust change or session rebind without state drift.
 *
 * Rules (locked by the V2 plan, Task 10):
 *   1. Unknown tokens are always denied.
 *   2. Critical-risk tokens always require explicit per-session consent;
 *      the broker returns `granted: false` and the caller MUST walk
 *      the consent UX.
 *   3. Built-in plugins get the baseline grant for free, EXCEPT for
 *      tokens in NEVER_AUTO_GRANT.
 *   4. local-dev and signed-third-party plugins must enumerate every
 *      token in their grant list.
 *   5. unsigned-third-party plugins are denied every non-low token by
 *      default; they can only request low-risk tokens.
 */
export function evaluateBrokerRequest(input: {
	token: string
	trust: "built-in" | "local-dev" | "signed-third-party" | "unsigned-third-party"
	sessionScope: "session" | "project" | "app"
	grantedTokens: readonly string[]
}): BrokerDecision {
	const cls = lookupCapability(input.token)
	if (!cls) {
		return { granted: false, reason: "unknown capability", risk: "critical" }
	}

	if (cls.risk === "critical") {
		return {
			granted: input.grantedTokens.includes(input.token),
			reason: "critical-risk capability requires explicit per-session consent",
			risk: cls.risk,
		}
	}

	if (input.trust === "built-in") {
		if (NEVER_AUTO_GRANT.includes(input.token as KnownCapabilityToken)) {
			return {
				granted: input.grantedTokens.includes(input.token),
				reason: "built-in plugin must explicitly grant this token",
				risk: cls.risk,
			}
		}
		return {
			granted: true,
			reason: "built-in baseline grant",
			risk: cls.risk,
		}
	}

	if (input.trust === "unsigned-third-party") {
		if (cls.risk !== "low") {
			return {
				granted: false,
				reason: "unsigned-third-party plugins can only request low-risk capabilities",
				risk: cls.risk,
			}
		}
		return {
			granted: input.grantedTokens.includes(input.token),
			reason: "low-risk unsigned-third-party capability requires explicit grant",
			risk: cls.risk,
		}
	}

	return {
		granted: input.grantedTokens.includes(input.token),
		reason: `${input.trust} capability requires explicit grant`,
		risk: cls.risk,
	}
}

/**
 * Audit log record. The broker emits one of these for every
 * grant/deny decision so the operator UI can show the user a clear
 * history.
 */
export interface CapabilityAuditEntry {
	readonly timestamp: number
	readonly pluginId: string
	readonly token: string
	readonly sessionScope: "session" | "project" | "app"
	readonly sessionId: string | null
	readonly decision: BrokerDecision
}
