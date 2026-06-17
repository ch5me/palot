import { describe, expect, it } from "bun:test"

import type { IPluginStorageService } from "./plugin-storage-service"
import type { GrantStore } from "./grant-store"
import { createWorkerRequestHandler } from "./worker-request-handler"

function fakeStorage(): IPluginStorageService {
	const kv = new Map<string, unknown>()
	const k = (i: { pluginId: string; scope: string; scopeId: string; key: string }) =>
		`${i.pluginId}:${i.scope}:${i.scopeId}:${i.key}`
	return {
		async get(i) {
			return kv.get(k(i))
		},
		async set(i) {
			kv.set(k(i), i.value)
		},
		async delete(i) {
			kv.delete(k(i))
		},
		async list(i) {
			const prefix = `${i.pluginId}:${i.scope}:${i.scopeId}:`
			return [...kv.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length))
		},
		async getSecret() {
			return undefined
		},
		async setSecret() {},
		async deleteSecret() {},
	}
}

function fakeGrants(granted: string[]): GrantStore {
	return {
		async upsert() {},
		async upsertMany() {},
		async listForPlugin() {
			return []
		},
		async resolveGrantedTokens() {
			return granted
		},
		async revoke() {},
		async revokeAll() {},
		async revokeAllForVersion() {},
	}
}

describe("worker-request-handler", () => {
	it("services storage set→get→list→delete round-trip", async () => {
		const handler = createWorkerRequestHandler({ storage: fakeStorage(), grants: fakeGrants([]) })
		const pluginId = "p.x"

		const setRes = await handler({
			pluginId,
			message: { type: "storage-request", requestId: "1", request: { op: "set", scope: "app", key: "k", value: { a: 1 } } },
		})
		expect(setRes).toEqual({ type: "storage-response", requestId: "1", response: { ok: true } })

		const getRes = await handler({
			pluginId,
			message: { type: "storage-request", requestId: "2", request: { op: "get", scope: "app", key: "k" } },
		})
		expect(getRes).toEqual({ type: "storage-response", requestId: "2", response: { ok: true, value: { a: 1 } } })

		const listRes = await handler({
			pluginId,
			message: { type: "storage-request", requestId: "3", request: { op: "list", scope: "app" } },
		})
		expect(listRes).toEqual({ type: "storage-response", requestId: "3", response: { ok: true, keys: ["k"] } })

		await handler({
			pluginId,
			message: { type: "storage-request", requestId: "4", request: { op: "delete", scope: "app", key: "k" } },
		})
		const after = await handler({
			pluginId,
			message: { type: "storage-request", requestId: "5", request: { op: "get", scope: "app", key: "k" } },
		})
		expect(after).toEqual({ type: "storage-response", requestId: "5", response: { ok: true, value: undefined } })
	})

	it("capability-request: granted only when the grant store grants it (deny-by-default)", async () => {
		const handler = createWorkerRequestHandler({ storage: fakeStorage(), grants: fakeGrants(["net:http"]) })
		const yes = await handler({
			pluginId: "p.x",
			message: { type: "capability-request", requestId: "c1", capability: "net:http", reason: "" },
		})
		expect(yes).toMatchObject({ type: "capability-response", requestId: "c1", granted: true })

		const no = await handler({
			pluginId: "p.x",
			message: { type: "capability-request", requestId: "c2", capability: "fs:write", reason: "" },
		})
		expect(no).toMatchObject({ type: "capability-response", requestId: "c2", granted: false })
	})

	it("returns null for messages the supervisor owns (invoke-result)", async () => {
		const handler = createWorkerRequestHandler({ storage: fakeStorage(), grants: fakeGrants([]) })
		const res = await handler({
			pluginId: "p.x",
			message: { type: "invoke-result", requestId: "r", ok: true },
		})
		expect(res).toBeNull()
	})

	it("storage errors become a typed failed storage-response (no throw)", async () => {
		const throwing: IPluginStorageService = {
			...fakeStorage(),
			async set() {
				const e = new Error("quota") as Error & { code: string }
				e.code = "quota_exceeded"
				throw e
			},
		}
		const handler = createWorkerRequestHandler({ storage: throwing, grants: fakeGrants([]) })
		const res = await handler({
			pluginId: "p.x",
			message: { type: "storage-request", requestId: "9", request: { op: "set", scope: "app", key: "k", value: 1 } },
		})
		expect(res).toEqual({
			type: "storage-response",
			requestId: "9",
			response: { ok: false, errorCode: "quota_exceeded", errorMessage: "quota" },
		})
	})
})
