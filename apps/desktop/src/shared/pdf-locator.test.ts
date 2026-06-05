import assert from "node:assert/strict"
import test from "node:test"
import {
	PDF_LOCATOR_RESOLUTION,
	PDF_LOCATOR_SCHEMA_VERSION,
	buildResolvedLocator,
	buildUnresolvedLocator,
	deserializePdfLocator,
	isResolvedLocator,
	serializePdfLocator,
} from "./pdf-locator"

test("buildResolvedLocator stamps the current schema version and documentId", () => {
	const locator = buildResolvedLocator({
		documentId: "doc-42",
		page: 7,
		quote: { exact: "needle", prefix: "before ", suffix: " after" },
		position: { page: 7, start: 100, end: 106 },
		structural: { kind: "section", label: "Findings" },
		confidence: 0.92,
	})
	assert.equal(locator.schemaVersion, PDF_LOCATOR_SCHEMA_VERSION)
	assert.equal(locator.documentId, "doc-42")
	assert.equal(locator.resolution, "resolved")
	assert.equal(locator.page, 7)
	assert.equal(locator.position.end - locator.position.start, locator.quote.exact.length)
	assert.ok(typeof locator.createdAt === "string")
})

test("serialize then deserialize round-trips a resolved locator", () => {
	const original = buildResolvedLocator({
		documentId: "doc-roundtrip",
		page: 3,
		quote: { exact: "alpha beta" },
		position: { page: 3, start: 5, end: 15 },
	})
	const wire = serializePdfLocator(original)
	const back = deserializePdfLocator(wire)
	assert.equal(back.schemaVersion, original.schemaVersion)
	assert.equal(back.documentId, original.documentId)
	assert.equal(back.resolution, original.resolution)
	if (back.resolution === "resolved" && original.resolution === "resolved") {
		assert.equal(back.page, original.page)
		assert.deepEqual(back.quote, original.quote)
		assert.deepEqual(back.position, original.position)
	}
})

test("serialize rejects unsupported schemaVersion", () => {
	const stale = {
		...buildResolvedLocator({
			documentId: "doc-stale",
			page: 1,
			quote: { exact: "x" },
			position: { page: 1, start: 0, end: 1 },
		}),
		schemaVersion: PDF_LOCATOR_SCHEMA_VERSION + 99,
	}
	assert.throws(() => serializePdfLocator(stale as never), /schemaVersion/)
})

test("deserialize rejects malformed payload", () => {
	assert.throws(() => deserializePdfLocator("not json"), /JSON/)
	assert.throws(
		() => deserializePdfLocator(JSON.stringify({ documentId: "x" })),
		/Malformed/,
	)
	assert.throws(
		() => deserializePdfLocator(JSON.stringify({ schemaVersion: PDF_LOCATOR_SCHEMA_VERSION })),
		/Malformed/,
	)
	assert.throws(
		() => deserializePdfLocator(JSON.stringify({ resolution: "resolved" })),
		/Malformed/,
	)
})

test("isResolvedLocator narrows to non-unresolved variants", () => {
	const unresolved = buildUnresolvedLocator({
		documentId: "doc-pending",
		quote: { exact: "missing" },
		attempted: ["quote", "context"],
		reason: "extraction drift",
	})
	assert.equal(unresolved.resolution, "unresolved")
	assert.equal(isResolvedLocator(unresolved), false)
	assert.equal(unresolved.schemaVersion, PDF_LOCATOR_SCHEMA_VERSION)
	const resolved = buildResolvedLocator({
		documentId: "doc-ok",
		page: 1,
		quote: { exact: "x" },
		position: { page: 1, start: 0, end: 1 },
	})
	assert.equal(isResolvedLocator(resolved), true)
})

test("resolution enum covers all four states", () => {
	const states = Object.values(PDF_LOCATOR_RESOLUTION)
	assert.deepEqual(states.sort(), ["ambiguous", "page-only", "resolved", "unresolved"])
})
