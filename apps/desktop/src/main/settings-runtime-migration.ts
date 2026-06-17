import type {
	AppSettings,
	LocalRuntimeKind,
	LocalRuntimeOwnership,
	ServerConfig,
} from "../preload/api"

const LEGACY_LOCAL_RUNTIME_KIND: LocalRuntimeKind = "host"
const LEGACY_LOCAL_OWNERSHIP: LocalRuntimeOwnership = "managed"

/**
 * Migrate legacy server records to the alpha runtime model.
 *
 * - Legacy `local` records (missing `runtimeKind`/`ownership`) get deterministic
 *   defaults: runtimeKind="host", ownership="managed". This preserves the
 *   historical behavior where Elf spawned the host-installed `opencode`.
 * - `remote` and `ssh` records are untouched (no runtime fields needed).
 * - Idempotent: re-running on already-migrated settings is a no-op.
 * - Never touches host OpenCode config/data/auth directories.
 */
export function migrateRuntimeSettings(input: AppSettings): AppSettings {
	let changed = false
	const migratedServers = input.servers.servers.map((server): ServerConfig => {
		if (server.type !== "local") return server
		if (server.runtimeKind && server.ownership) return server
		changed = true
		return {
			...server,
			runtimeKind: server.runtimeKind ?? LEGACY_LOCAL_RUNTIME_KIND,
			ownership: server.ownership ?? LEGACY_LOCAL_OWNERSHIP,
		}
	})

	if (!changed) return input
	return {
		...input,
		servers: { ...input.servers, servers: migratedServers },
	}
}
