import { describe, expect, test } from "bun:test"
import type { AppSettings, LocalServerConfig, RemoteServerConfig } from "../preload/api"
import { migrateRuntimeSettings } from "./settings-runtime-migration"

function makeSettings(
	servers: AppSettings["servers"]["servers"],
	activeServerId = "local",
): AppSettings {
	return {
		notifications: {
			completionMode: "unfocused",
			permissions: true,
			questions: true,
			errors: true,
			dockBadge: true,
		},
		opaqueWindows: false,
		servers: { servers, activeServerId },
		connections: {},
	}
}

const LEGACY_LOCAL: LocalServerConfig = {
	id: "local",
	name: "This Mac",
	type: "local",
	port: 14096,
}

const LEGACY_REMOTE: RemoteServerConfig = {
	id: "remote-1",
	name: "Office Server",
	type: "remote",
	url: "https://opencode.example.com:14096",
	username: "opencode",
}

describe("migrateRuntimeSettings", () => {
	test("adds runtimeKind and ownership to legacy local server", () => {
		const input = makeSettings([LEGACY_LOCAL])
		const result = migrateRuntimeSettings(input)

		expect(result.servers.servers).toHaveLength(1)
		const local = result.servers.servers[0] as LocalServerConfig
		expect(local.type).toBe("local")
		expect(local.runtimeKind).toBe("host")
		expect(local.ownership).toBe("managed")
	})

	test("preserves existing port and name on legacy local server", () => {
		const input = makeSettings([LEGACY_LOCAL])
		const result = migrateRuntimeSettings(input)
		const local = result.servers.servers[0] as LocalServerConfig

		expect(local.port).toBe(14096)
		expect(local.name).toBe("This Mac")
		expect(local.id).toBe("local")
	})

	test("does not modify remote servers", () => {
		const input = makeSettings([LEGACY_LOCAL, LEGACY_REMOTE])
		const result = migrateRuntimeSettings(input)

		const remote = result.servers.servers.find((s) => s.type === "remote") as
			| RemoteServerConfig
			| undefined
		expect(remote).toEqual(LEGACY_REMOTE)
		expect("runtimeKind" in (remote ?? {})).toBe(false)
		expect("ownership" in (remote ?? {})).toBe(false)
	})

	test("is idempotent — rerun on migrated settings returns same reference", () => {
		const input = makeSettings([LEGACY_LOCAL])
		const first = migrateRuntimeSettings(input)
		const second = migrateRuntimeSettings(first)

		expect(second).toBe(first)
	})

	test("is idempotent — migrated values unchanged after second pass", () => {
		const input = makeSettings([LEGACY_LOCAL])
		const first = migrateRuntimeSettings(input)
		const second = migrateRuntimeSettings(first)

		const local = second.servers.servers[0] as LocalServerConfig
		expect(local.runtimeKind).toBe("host")
		expect(local.ownership).toBe("managed")
	})

	test("returns same reference when no migration needed (fresh install)", () => {
		const fresh: LocalServerConfig = {
			id: "local",
			name: "This Mac",
			type: "local",
			runtimeKind: "bundled",
			ownership: "managed",
			port: 14096,
		}
		const input = makeSettings([fresh])
		const result = migrateRuntimeSettings(input)

		expect(result).toBe(input)
	})

	test("handles partial migration — only runtimeKind missing", () => {
		const partial: LocalServerConfig = {
			id: "local",
			name: "This Mac",
			type: "local",
			ownership: "attach-only",
			port: 14096,
		}
		const input = makeSettings([partial])
		const result = migrateRuntimeSettings(input)
		const local = result.servers.servers[0] as LocalServerConfig

		expect(local.runtimeKind).toBe("host")
		expect(local.ownership).toBe("attach-only")
	})

	test("handles partial migration — only ownership missing", () => {
		const partial: LocalServerConfig = {
			id: "local",
			name: "This Mac",
			type: "local",
			runtimeKind: "bundled",
			port: 14096,
		}
		const input = makeSettings([partial])
		const result = migrateRuntimeSettings(input)
		const local = result.servers.servers[0] as LocalServerConfig

		expect(local.runtimeKind).toBe("bundled")
		expect(local.ownership).toBe("managed")
	})

	test("does not mutate input", () => {
		const input = makeSettings([{ ...LEGACY_LOCAL }])
		const originalLocal = { ...input.servers.servers[0] }
		migrateRuntimeSettings(input)

		expect(input.servers.servers[0]).toEqual(originalLocal)
		expect((input.servers.servers[0] as LocalServerConfig).runtimeKind).toBeUndefined()
	})

	test("preserves activeServerId and other settings fields", () => {
		const input = makeSettings([LEGACY_LOCAL], "local")
		input.opaqueWindows = true
		const result = migrateRuntimeSettings(input)

		expect(result.servers.activeServerId).toBe("local")
		expect(result.opaqueWindows).toBe(true)
		expect(result.notifications.completionMode).toBe("unfocused")
	})

	test("handles empty servers array", () => {
		const input = makeSettings([])
		const result = migrateRuntimeSettings(input)

		expect(result).toBe(input)
		expect(result.servers.servers).toHaveLength(0)
	})

	test("handles multiple local servers", () => {
		const secondLocal: LocalServerConfig = {
			id: "local",
			name: "Secondary",
			type: "local",
			port: 14097,
		}
		const input = makeSettings([LEGACY_LOCAL, secondLocal, LEGACY_REMOTE])
		const result = migrateRuntimeSettings(input)

		const locals = result.servers.servers.filter((s) => s.type === "local")
		expect(locals).toHaveLength(2)
		for (const local of locals) {
			expect((local as LocalServerConfig).runtimeKind).toBe("host")
			expect((local as LocalServerConfig).ownership).toBe("managed")
		}
	})
})
