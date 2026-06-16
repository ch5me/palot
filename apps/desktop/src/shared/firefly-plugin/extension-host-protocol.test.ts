import { describe, expect, it } from "bun:test"

import {
	hostToWorkerMessageSchema,
	parseHostToWorkerMessage,
	parseWorkerToHostMessage,
	storageRequestSchema,
	workerLifecycleMessageSchema,
	workerToHostMessageSchema,
} from "./extension-host-protocol"

describe("extension-host-protocol", () => {
	it("lifecycle subset accepts ready/heartbeat/fatal and rejects unknown", () => {
		expect(workerLifecycleMessageSchema.safeParse({ type: "ready" }).success).toBe(true)
		expect(workerLifecycleMessageSchema.safeParse({ type: "heartbeat" }).success).toBe(true)
		expect(workerLifecycleMessageSchema.safeParse({ type: "fatal", message: "boom" }).success).toBe(true)
		expect(workerLifecycleMessageSchema.safeParse({ type: "nope" }).success).toBe(false)
	})

	it("activate carries a granted-capability snapshot with a default", () => {
		const parsed = hostToWorkerMessageSchema.safeParse({ type: "activate", pluginId: "acme.thing" })
		expect(parsed.success).toBe(true)
		if (parsed.success && parsed.data.type === "activate") {
			expect(parsed.data.grantedCapabilities).toEqual([])
			expect(parsed.data.sessionScope).toBe("session")
		}
	})

	it("storage request round-trips every op", () => {
		expect(storageRequestSchema.safeParse({ op: "get", scope: "app", key: "k" }).success).toBe(true)
		expect(storageRequestSchema.safeParse({ op: "set", scope: "project", key: "k", value: { a: 1 } }).success).toBe(true)
		expect(storageRequestSchema.safeParse({ op: "delete", scope: "session", key: "k" }).success).toBe(true)
		expect(storageRequestSchema.safeParse({ op: "list", scope: "global-profile" }).success).toBe(true)
		expect(storageRequestSchema.safeParse({ op: "get", scope: "not-a-scope", key: "k" }).success).toBe(false)
	})

	it("worker→host storage-request and capability-request validate", () => {
		expect(
			workerToHostMessageSchema.safeParse({
				type: "storage-request",
				requestId: "r1",
				request: { op: "get", scope: "app", key: "k" },
			}).success,
		).toBe(true)
		expect(
			workerToHostMessageSchema.safeParse({
				type: "capability-request",
				requestId: "r2",
				capability: "net:http",
			}).success,
		).toBe(true)
	})

	it("parse helpers fail loud with a reason, never silently drop", () => {
		const bad = parseWorkerToHostMessage({ type: "garbage" })
		expect(bad.ok).toBe(false)
		if (!bad.ok) expect(typeof bad.reason).toBe("string")

		const good = parseHostToWorkerMessage({ type: "deactivate", pluginId: "acme.thing" })
		expect(good.ok).toBe(true)
	})
})
