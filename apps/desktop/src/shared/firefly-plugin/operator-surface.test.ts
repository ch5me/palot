import { describe, expect, test } from "bun:test"
import {
	OPERATOR_ACTIONS,
	OPERATOR_ACTION_AVAILABILITY,
	OPERATOR_SCOPE,
	REQUIRED_OPERATOR_FIELDS,
	availableOperatorActions,
	buildOperatorPluginRow,
	operatorActionSchema,
	operatorPluginRowSchema,
} from "./operator-surface"

describe("operator-surface", () => {
	const baseRow = {
		pluginId: "firefly.built-in.palot-bridge",
		displayName: "Palot Bridge",
		version: "2.0.0",
		trustTier: "built-in" as const,
		enabled: true,
		quarantined: false,
		grantedCapabilities: ["capability.session.read", "capability.theme.read"],
		activeSessionBindings: 1,
		exposedTools: ["plugin.firefly.built-in.palot-bridge.ping"],
		lastCrash: null,
		quarantineStatus: "none" as const,
		appliedThemeOwnership: null,
	}

	test("schema rejects unknown fields (strict)", () => {
		const r = operatorPluginRowSchema.safeParse({ ...baseRow, extra: "nope" })
		expect(r.success).toBe(false)
	})

	test("schema rejects missing required fields", () => {
		const { pluginId, ...rest } = baseRow
		const r = operatorPluginRowSchema.safeParse(rest)
		expect(r.success).toBe(false)
	})

	test("OPERATOR_ACTIONS is the locked 8-action set", () => {
		expect(new Set(OPERATOR_ACTIONS)).toEqual(
			new Set([
				"enable",
				"disable",
				"reload",
				"quarantine",
				"release-quarantine",
				"review-permissions",
				"view-logs",
				"uninstall",
			]),
		)
	})

	test("operatorActionSchema validates any action", () => {
		for (const a of OPERATOR_ACTIONS) {
			expect(operatorActionSchema.safeParse(a).success).toBe(true)
		}
	})

	test("OPERATOR_ACTION_AVAILABILITY covers every action", () => {
		const listed = new Set(OPERATOR_ACTION_AVAILABILITY.map((row) => row.action))
		for (const a of OPERATOR_ACTIONS) {
			expect(listed.has(a)).toBe(true)
		}
	})

	test("OPERATOR_SCOPE keeps marketplace OUT (lock-in-source)", () => {
		expect(OPERATOR_SCOPE.includesMarketplaceBrowse).toBe(false)
		expect(OPERATOR_SCOPE.includesMarketplaceDiscover).toBe(false)
		expect(OPERATOR_SCOPE.includesMarketplaceRanking).toBe(false)
		expect(OPERATOR_SCOPE.includesMarketplacePurchase).toBe(false)
		expect(OPERATOR_SCOPE.includesLifecycle).toBe(true)
		expect(OPERATOR_SCOPE.includesInventory).toBe(true)
	})

	test("REQUIRED_OPERATOR_FIELDS matches the V2 plan must-have", () => {
		expect(new Set(REQUIRED_OPERATOR_FIELDS)).toEqual(
			new Set([
				"trustTier",
				"grantedCapabilities",
				"activeSessionBindings",
				"exposedTools",
				"lastCrash",
				"quarantineStatus",
				"appliedThemeOwnership",
			]),
		)
	})

	test("availableOperatorActions: enabled built-in row has review/disable/reload/quarantine/logs", () => {
		const actions = availableOperatorActions(baseRow)
		expect(actions).toContain("disable")
		expect(actions).toContain("reload")
		expect(actions).toContain("quarantine")
		expect(actions).toContain("review-permissions")
		expect(actions).toContain("view-logs")
		expect(actions).not.toContain("enable")
		expect(actions).not.toContain("release-quarantine")
		expect(actions).not.toContain("uninstall")
	})

	test("availableOperatorActions: disabled row exposes enable", () => {
		const actions = availableOperatorActions({ ...baseRow, enabled: false })
		expect(actions).toContain("enable")
		expect(actions).not.toContain("disable")
		expect(actions).not.toContain("reload")
	})

	test("availableOperatorActions: quarantined row exposes release-quarantine plus all read-only actions", () => {
		const actions = availableOperatorActions({ ...baseRow, quarantined: true })
		expect(actions).toContain("release-quarantine")
		expect(actions).toContain("review-permissions")
		expect(actions).toContain("view-logs")
		// enabled built-in kept lifecycle actions; quarantine adds release path
		expect(actions).toContain("disable")
		expect(actions).toContain("reload")
		expect(actions).toContain("quarantine")
		expect(actions).not.toContain("enable")
	})

	test("availableOperatorActions: third-party row exposes uninstall", () => {
		const actions = availableOperatorActions({
			...baseRow,
			trustTier: "signed-third-party",
		})
		expect(actions).toContain("uninstall")
	})

	test("availableOperatorActions: built-in row omits uninstall", () => {
		expect(availableOperatorActions(baseRow)).not.toContain("uninstall")
	})

	test("buildOperatorPluginRow round-trips through schema", () => {
		const built = buildOperatorPluginRow(baseRow)
		expect(built).toEqual(baseRow)
	})

	test("buildOperatorPluginRow does not allow extras (strict Zod schema)", () => {
		const parseAttempt = operatorPluginRowSchema.safeParse({
			...baseRow,
			extra: "x",
		})
		expect(parseAttempt.success).toBe(false)
	})

	test("availableOperatorActions: review-permissions and view-logs are always present", () => {
		const variants = [
			{ ...baseRow, enabled: true, quarantined: false },
			{ ...baseRow, enabled: false, quarantined: false },
			{ ...baseRow, enabled: true, quarantined: true },
			{ ...baseRow, enabled: false, quarantined: true },
		]
		for (const v of variants) {
			const actions = availableOperatorActions(v)
			expect(actions).toContain("review-permissions")
			expect(actions).toContain("view-logs")
		}
	})
})
