import { describe, expect, it } from "bun:test"

import {
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
