import { describe, expect, test } from "bun:test"
import {
	createSplitDockDragPayload,
	parseSplitDockDragPayload,
	serializeSplitDockDragPayload,
	validateSplitDockTransferPayload,
} from "./split-dock-transfer-bridge"

describe("split dock transfer bridge", () => {
	test("accepts valid move payloads for supported cross-zone transfers", () => {
		const payload = createSplitDockDragPayload({
			id: "session-surface",
			zone: "right",
			transferPolicies: ["move"],
		})

		expect(payload).not.toBeNull()

		const parsed = parseSplitDockDragPayload(serializeSplitDockDragPayload(payload!))
		const request = parsed
			? validateSplitDockTransferPayload({
					payload: parsed,
					targetZone: "bottom",
					descriptorsById: new Map([
						[
							"session-surface",
							{ id: "session-surface", zone: "right", transferPolicies: ["move"] },
						],
					]),
					targetPanelId: "session-widgets",
					targetPosition: "bottom",
				})
			: null

		expect(request).toEqual({
			panelId: "session-surface",
			sourceZone: "right",
			targetZone: "bottom",
			policy: "move",
			targetPanelId: "session-widgets",
			targetPosition: "bottom",
		})
	})

	test("rejects malformed, stale, and protected-zone payloads", () => {
		expect(parseSplitDockDragPayload("{bad json")).toBeNull()
		expect(parseSplitDockDragPayload(JSON.stringify({ version: 2, panelId: "x", sourceZone: "right", policy: "move" }))).toBeNull()

		const parsed = parseSplitDockDragPayload(
			JSON.stringify({ version: 1, panelId: "session-chat", sourceZone: "main", policy: "move" }),
		)
		expect(parsed).not.toBeNull()

		const staleDescriptor = validateSplitDockTransferPayload({
			payload: parsed!,
			targetZone: "right",
			descriptorsById: new Map([["session-chat", { id: "session-chat", zone: "bottom", transferPolicies: ["move"] }]]),
		})
		expect(staleDescriptor).toBeNull()

		const protectedMove = validateSplitDockTransferPayload({
			payload: parsed!,
			targetZone: "right",
			descriptorsById: new Map([
				[
					"session-chat",
					{
						id: "session-chat",
						zone: "main",
						transferPolicies: ["move"],
						protection: { protected: true, requiredZone: "main" },
					},
				],
			]),
		})
		expect(protectedMove).toBeNull()
	})

	test("keeps room for future clone policy without accepting unsupported descriptors", () => {
		expect(
			createSplitDockDragPayload({
				id: "session-widgets",
				zone: "bottom",
				transferPolicies: ["move"],
			}, "clone"),
		).toBeNull()

		const clonePayload = createSplitDockDragPayload({
			id: "session-widgets",
			zone: "bottom",
			transferPolicies: ["move", "clone"],
		}, "clone")

		expect(clonePayload?.policy).toBe("clone")
	})
})
