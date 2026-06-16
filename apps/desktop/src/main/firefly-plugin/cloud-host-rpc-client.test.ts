import { describe, expect, it } from "bun:test"

import {
	type CatalogProjectionSnapshot,
	CloudHostNotConfiguredError,
	CloudHostRpcError,
	createCloudHostRpcClient,
	resolveCloudHostConfig,
} from "./cloud-host-rpc-client"

describe("resolveCloudHostConfig", () => {
	it("returns null when FIREFLY_CLOUD_URL is absent (no guessed default)", () => {
		expect(resolveCloudHostConfig({})).toBeNull()
		expect(resolveCloudHostConfig({ FIREFLY_CLOUD_URL: "  " })).toBeNull()
	})

	it("strips a trailing slash and captures the optional token", () => {
		const cfg = resolveCloudHostConfig({ FIREFLY_CLOUD_URL: "https://cloud.example/", FIREFLY_CLOUD_TOKEN: "t1" })
		expect(cfg).toEqual({ baseUrl: "https://cloud.example", token: "t1" })
	})
})

describe("createCloudHostRpcClient", () => {
	it("unconfigured: fails fast with a named precondition (no silent fallback)", async () => {
		const client = createCloudHostRpcClient({ config: null })
		expect(client.configured).toBe(false)
		await expect(client.call("invoke", {})).rejects.toBeInstanceOf(CloudHostNotConfiguredError)
		try {
			await client.call("invoke", {})
		} catch (e) {
			expect((e as CloudHostNotConfiguredError).missing).toBe("FIREFLY_CLOUD_URL")
		}
	})

	it("configured: posts method+params to the rpc endpoint with auth and returns parsed json", async () => {
		const calls: { url: string; body: string; headers: Record<string, string> }[] = []
		const client = createCloudHostRpcClient({
			config: { baseUrl: "https://cloud.example", token: "t1" },
			fetchFn: async (url, init) => {
				calls.push({ url, body: init.body, headers: init.headers })
				return { ok: true, status: 200, json: async () => ({ status: "completed" }), text: async () => "" }
			},
		})
		const result = await client.call<{ status: string }>("invoke", { pluginId: "p.x" })
		expect(result).toEqual({ status: "completed" })
		expect(calls[0]?.url).toBe("https://cloud.example/firefly-plugin/rpc")
		expect(calls[0]?.headers.authorization).toBe("Bearer t1")
		expect(JSON.parse(calls[0]?.body ?? "{}")).toEqual({ method: "invoke", params: { pluginId: "p.x" } })
	})

	it("non-ok response throws a typed CloudHostRpcError with the status", async () => {
		const client = createCloudHostRpcClient({
			config: { baseUrl: "https://cloud.example", token: null },
			fetchFn: async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "down" }),
		})
		await expect(client.call("catalog", {})).rejects.toBeInstanceOf(CloudHostRpcError)
	})
})

describe("fetchProjectionSnapshot (D-P2)", () => {
	it("POSTs method 'projectionSnapshot' with no sinceRevision param when called without args", async () => {
		const calls: { method: string; params: Record<string, unknown> }[] = []
		const snapshot: CatalogProjectionSnapshot = { revision: 3, fetchedAt: "2026-06-16T00:00:00Z" }
		const client = createCloudHostRpcClient({
			config: { baseUrl: "https://cloud.example", token: "tok" },
			fetchFn: async (_url, init) => {
				const body = JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
				calls.push({ method: body.method, params: body.params })
				return { ok: true, status: 200, json: async () => snapshot, text: async () => "" }
			},
		})
		const result = await client.fetchProjectionSnapshot()
		expect(calls).toHaveLength(1)
		expect(calls[0]?.method).toBe("projectionSnapshot")
		expect(calls[0]?.params).toEqual({})
		expect(result).toEqual(snapshot)
	})

	it("includes sinceRevision in params when provided", async () => {
		const calls: { method: string; params: Record<string, unknown> }[] = []
		const snapshot: CatalogProjectionSnapshot = { revision: 7, fetchedAt: "2026-06-16T01:00:00Z" }
		const client = createCloudHostRpcClient({
			config: { baseUrl: "https://cloud.example", token: null },
			fetchFn: async (_url, init) => {
				const body = JSON.parse(init.body) as { method: string; params: Record<string, unknown> }
				calls.push({ method: body.method, params: body.params })
				return { ok: true, status: 200, json: async () => snapshot, text: async () => "" }
			},
		})
		const result = await client.fetchProjectionSnapshot(5)
		expect(calls[0]?.method).toBe("projectionSnapshot")
		expect(calls[0]?.params).toEqual({ sinceRevision: 5 })
		expect(result.revision).toBe(7)
	})

	it("throws CloudHostNotConfiguredError when unconfigured", async () => {
		const client = createCloudHostRpcClient({ config: null })
		await expect(client.fetchProjectionSnapshot()).rejects.toBeInstanceOf(CloudHostNotConfiguredError)
		await expect(client.fetchProjectionSnapshot(1)).rejects.toBeInstanceOf(CloudHostNotConfiguredError)
	})
})

describe("subscribeProjection (D-P2 stub)", () => {
	it("throws CloudHostNotConfiguredError immediately when unconfigured", () => {
		const client = createCloudHostRpcClient({ config: null })
		expect(() => client.subscribeProjection(() => {})).toThrow(CloudHostNotConfiguredError)
	})

	it("returns an unsubscribe function when configured (stub — no live push yet)", () => {
		const client = createCloudHostRpcClient({
			config: { baseUrl: "https://cloud.example", token: null },
			fetchFn: async () => {
				throw new Error("should not be called by subscribeProjection")
			},
		})
		const received: CatalogProjectionSnapshot[] = []
		const unsub = client.subscribeProjection((s) => received.push(s))
		expect(typeof unsub).toBe("function")
		// stub: no snapshots delivered automatically (live push transport lands in D-C5)
		expect(received).toHaveLength(0)
		// calling unsubscribe must not throw
		expect(() => unsub()).not.toThrow()
	})
})
