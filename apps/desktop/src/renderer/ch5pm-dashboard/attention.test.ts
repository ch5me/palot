import assert from "node:assert/strict"
import test from "node:test"
import {
	Ch5PmAttentionActionError,
	extractAttentionErrorMessage,
	fmtAttentionAge,
	orderAttentionItems,
	visibleAttentionItems,
} from "./attention"
import type { Ch5PmAttentionItem, Ch5PmAttentionQueue } from "./types"

function makeItem(overrides: Partial<Ch5PmAttentionItem> & { id: string }): Ch5PmAttentionItem {
	return {
		createdAt: 1_770_000_000_000,
		updatedAt: 1_770_000_000_000,
		priority: "p1",
		state: "open",
		what: "Decide something",
		whyNow: "Blocking a worker",
		options: [{ label: "Yes" }, { label: "No" }],
		...overrides,
	}
}

test("orderAttentionItems puts p0 first and keeps newest-first within a priority", () => {
	const newestP1 = makeItem({ id: "att_p1_new", priority: "p1", createdAt: 300 })
	const olderP1 = makeItem({ id: "att_p1_old", priority: "p1", createdAt: 100 })
	const p0 = makeItem({ id: "att_p0", priority: "p0", createdAt: 200 })
	const p2 = makeItem({ id: "att_p2", priority: "p2", createdAt: 400 })
	// API order: newest first.
	const ordered = orderAttentionItems([p2, newestP1, p0, olderP1])
	assert.deepEqual(
		ordered.map((item) => item.id),
		["att_p0", "att_p1_new", "att_p1_old", "att_p2"],
	)
})

test("visibleAttentionItems filters optimistically-settled ids and tolerates missing queue", () => {
	const queue: Ch5PmAttentionQueue = {
		open: [makeItem({ id: "att_a" }), makeItem({ id: "att_b" })],
		counts: { total: 2, p0: 0, p1: 2, p2: 0 },
	}
	assert.deepEqual(
		visibleAttentionItems(queue, new Set(["att_a"])).map((item) => item.id),
		["att_b"],
	)
	assert.deepEqual(visibleAttentionItems(undefined, new Set()), [])
})

test("extractAttentionErrorMessage reads typed errors, step reasons, and falls back", () => {
	assert.equal(
		extractAttentionErrorMessage({ ok: false, error: "attention item att_x is already answered; only open items can transition" }, "fallback"),
		"attention item att_x is already answered; only open items can transition",
	)
	assert.equal(
		extractAttentionErrorMessage(
			{ ok: false, steps: [{ step: "validate-attention-resolve", succeeded: false, reason: "id required" }] },
			"fallback",
		),
		"id required",
	)
	assert.equal(extractAttentionErrorMessage("garbage", "fallback"), "fallback")
	assert.equal(extractAttentionErrorMessage(null, "fallback"), "fallback")
})

test("Ch5PmAttentionActionError carries the upstream status", () => {
	const err = new Ch5PmAttentionActionError(409, "already resolved")
	assert.equal(err.status, 409)
	assert.equal(err.name, "Ch5PmAttentionActionError")
	assert.equal(err.message, "already resolved")
})

test("fmtAttentionAge formats epoch-ms ages compactly", () => {
	const now = 1_770_000_000_000
	assert.equal(fmtAttentionAge(now - 30_000, now), "30s")
	assert.equal(fmtAttentionAge(now - 5 * 60_000, now), "5m")
	assert.equal(fmtAttentionAge(now - 3 * 3_600_000, now), "3h")
	assert.equal(fmtAttentionAge(now - 72 * 3_600_000, now), "3d")
})
