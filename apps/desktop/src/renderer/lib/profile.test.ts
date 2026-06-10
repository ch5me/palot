// bun:test (not node:test): node:test files raise NotImplementedError in
// multi-file `bun test` runs (oven-sh/bun#5090) and silently never execute.
import { test } from "bun:test"
import assert from "node:assert/strict"
import {
	DEFAULT_FIREFLY_PROFILE,
	type FireflyMode,
	type FireflyProfile,
	gateAgentSelection,
	migrateFireflyProfile,
	normalizeFireflyProfileLabel,
	resolveFireflyMode,
	resolveToolbarGating,
} from "./profile"

test("normalizeFireflyProfileLabel trims, collapses whitespace, and limits length", () => {
	assert.equal(normalizeFireflyProfileLabel("   work   profile   "), "work profile")
	assert.equal(
		normalizeFireflyProfileLabel("this profile label is intentionally much too long to keep"),
		"this profile label is intentiona",
	)
})

// ============================================================
// Mode migration
// ============================================================

test("migrateFireflyProfile fills missing mode with simple and preserves other fields", () => {
	const stored: FireflyProfile = { id: "p1", label: "Work", description: "Old profile" }
	const migrated = migrateFireflyProfile(stored)
	assert.equal(migrated.mode, "simple")
	assert.equal(migrated.id, "p1")
	assert.equal(migrated.label, "Work")
	assert.equal(migrated.description, "Old profile")
})

test("migrateFireflyProfile keeps profiles with a valid mode untouched", () => {
	const stored: FireflyProfile = { id: "p1", label: "Work", mode: "power" }
	assert.equal(migrateFireflyProfile(stored), stored)
})

test("migrateFireflyProfile replaces an invalid stored mode with simple", () => {
	const stored = { id: "p1", label: "Work", mode: "turbo" } as unknown as FireflyProfile
	assert.equal(migrateFireflyProfile(stored).mode, "simple")
})

test("resolveFireflyMode defaults missing/invalid mode to simple", () => {
	assert.equal(resolveFireflyMode({}), "simple")
	assert.equal(resolveFireflyMode({ mode: undefined }), "simple")
	assert.equal(resolveFireflyMode({ mode: "nope" as unknown as FireflyMode }), "simple")
	assert.equal(resolveFireflyMode({ mode: "consumer" }), "consumer")
})

test("DEFAULT_FIREFLY_PROFILE ships in simple mode", () => {
	assert.equal(DEFAULT_FIREFLY_PROFILE.mode, "simple")
})

// ============================================================
// Toolbar gating
// ============================================================

const ROSTER = ["main", "plan", "atlas", "prometheus"]

test("consumer mode hides agent, model, and variant controls", () => {
	const gating = resolveToolbarGating({ mode: "consumer" }, ROSTER)
	assert.equal(gating.agentControl, "none")
	assert.equal(gating.showModelSelector, false)
	assert.equal(gating.showVariantSelector, false)
})

test("simple mode shows the Main/Plan toggle when both agents exist", () => {
	const gating = resolveToolbarGating({ mode: "simple" }, ROSTER)
	assert.equal(gating.agentControl, "main-plan-toggle")
	assert.equal(gating.showModelSelector, false)
	assert.equal(gating.showVariantSelector, false)
})

test("simple mode falls back to the full experience when main/plan are absent", () => {
	for (const roster of [["atlas", "prometheus"], ["main"], ["plan"], []]) {
		const gating = resolveToolbarGating({ mode: "simple" }, roster)
		assert.equal(gating.agentControl, "dropdown")
		assert.equal(gating.showModelSelector, true)
		assert.equal(gating.showVariantSelector, true)
		assert.deepEqual(gating.visibleAgentNames, roster)
	}
})

test("missing mode behaves as simple (legacy stored profiles)", () => {
	const gating = resolveToolbarGating({}, ROSTER)
	assert.equal(gating.agentControl, "main-plan-toggle")
})

test("power mode shows everything with the full roster", () => {
	const gating = resolveToolbarGating({ mode: "power" }, ROSTER)
	assert.equal(gating.agentControl, "dropdown")
	assert.equal(gating.showModelSelector, true)
	assert.equal(gating.showVariantSelector, true)
	assert.deepEqual(gating.visibleAgentNames, ROSTER)
})

test("custom mode filters the dropdown by the profile allowlist", () => {
	const gating = resolveToolbarGating({ mode: "custom", visibleAgents: ["main", "atlas"] }, ROSTER)
	assert.equal(gating.agentControl, "dropdown")
	assert.deepEqual(gating.visibleAgentNames, ["main", "atlas"])
	assert.equal(gating.showModelSelector, true)
	assert.equal(gating.showVariantSelector, true)
})

test("custom mode with an empty or missing allowlist shows all agents", () => {
	assert.deepEqual(
		resolveToolbarGating({ mode: "custom", visibleAgents: [] }, ROSTER).visibleAgentNames,
		ROSTER,
	)
	assert.deepEqual(resolveToolbarGating({ mode: "custom" }, ROSTER).visibleAgentNames, ROSTER)
})

test("custom allowlist entries unknown to the roster are dropped", () => {
	const gating = resolveToolbarGating({ mode: "custom", visibleAgents: ["main", "ghost"] }, ROSTER)
	assert.deepEqual(gating.visibleAgentNames, ["main"])
})

// ============================================================
// Send-path agent gating
// ============================================================

test("gateAgentSelection drops any override in consumer mode", () => {
	const gating = resolveToolbarGating({ mode: "consumer" }, ROSTER)
	assert.equal(gateAgentSelection(gating, "atlas"), null)
	assert.equal(gateAgentSelection(gating, null), null)
})

test("gateAgentSelection allows only main/plan through simple mode", () => {
	const gating = resolveToolbarGating({ mode: "simple" }, ROSTER)
	assert.equal(gateAgentSelection(gating, "main"), "main")
	assert.equal(gateAgentSelection(gating, "plan"), "plan")
	assert.equal(gateAgentSelection(gating, "atlas"), null)
	assert.equal(gateAgentSelection(gating, null), null)
})

test("gateAgentSelection passes selections through in power/custom modes", () => {
	const power = resolveToolbarGating({ mode: "power" }, ROSTER)
	assert.equal(gateAgentSelection(power, "atlas"), "atlas")
	const custom = resolveToolbarGating({ mode: "custom", visibleAgents: ["main"] }, ROSTER)
	assert.equal(gateAgentSelection(custom, "main"), "main")
})
