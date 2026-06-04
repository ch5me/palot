import assert from "node:assert/strict"
import test from "node:test"
import { normalizeFireflyProfileLabel } from "./profile"

test("normalizeFireflyProfileLabel trims, collapses whitespace, and limits length", () => {
	assert.equal(normalizeFireflyProfileLabel("   work   profile   "), "work profile")
	assert.equal(
		normalizeFireflyProfileLabel("this profile label is intentionally much too long to keep"),
		"this profile label is intentiona",
	)
})
