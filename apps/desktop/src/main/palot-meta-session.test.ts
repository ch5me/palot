import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, test } from "bun:test"
import type { Session, SessionStatus } from "@opencode-ai/sdk/v2/client"
import type { SessionBinding } from "../preload/api"
import {
	createPalotMetaSessionService,
	type PalotMetaSessionError,
} from "./palot-meta-session"

interface MockClientOptions {
	session: Session
	statuses?: Record<string, SessionStatus>
}

function buildSession(overrides: Partial<Session> = {}): Session {
	return {
		id: "ses_meta_child",
		slug: "meta-child",
		projectID: "proj_meta",
		directory: "/repo",
		title: "Meta child",
		version: "1",
		time: {
			created: Date.UTC(2026, 5, 17, 12, 0, 0),
			updated: Date.UTC(2026, 5, 17, 12, 5, 0),
		},
		...overrides,
	}
}

function createMockClient(options: MockClientOptions) {
	return {
		session: {
			create: async ({ title }: { title: string }) => ({
				data: {
					...options.session,
					title,
				},
			}),
			get: async ({ sessionID }: { sessionID: string }) => {
				if (sessionID !== options.session.id) {
					throw new Error(`missing session ${sessionID}`)
				}
				return { data: options.session }
			},
			status: async () => ({
				data: options.statuses ?? {},
			}),
		},
	}
}

function createTempStorePath(): string {
	const root = mkdtempSync(path.join(tmpdir(), "palot-meta-session-"))
	return path.join(root, "meta-sessions.json")
}

function createBinding(overrides: Partial<SessionBinding> = {}): SessionBinding {
	return {
		id: "binding_ses_meta_child",
		openCodeSessionId: "ses_meta_child",
		browserLaneId: null,
		magicBrowserSessionId: null,
		parentSessionId: null,
		status: "attached",
		createdAt: Date.UTC(2026, 5, 17, 12, 0, 0),
		updatedAt: Date.UTC(2026, 5, 17, 12, 6, 0),
		releasedAt: null,
		...overrides,
	}
}

describe("palot-meta-session", () => {
	test("create/list/get meta sessions uses local store only", () => {
		const storePath = createTempStorePath()
		const service = createPalotMetaSessionService({
			storePath,
			now: () => new Date("2026-06-17T12:00:00.000Z"),
		})

		const created = service.createMetaSession({ title: "Meta root" })

		expect(created.title).toBe("Meta root")
		expect(service.listMetaSessions()).toEqual([created])
		expect(service.getMetaSession(created.id)).toEqual(created)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("create child session hydrates active OpenCode status", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		const service = createPalotMetaSessionService({
			storePath,
			now: () => new Date("2026-06-17T12:00:00.000Z"),
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statuses: {
						[runtimeSession.id]: { type: "busy" },
					},
				}),
			getSessionBinding: () => createBinding(),
			workingDirectory: "/repo",
		})

		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		expect(child.runtimeSessionId).toBe(runtimeSession.id)
		expect(child.runtimeKind).toBe("opencode")
		expect(child.status).toBe("active")
		expect(child.lastHeartbeatAt).toBe("2026-06-17T12:06:00.000Z")

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("list child sessions falls back to binding lifecycle when live status missing", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		const service = createPalotMetaSessionService({
			storePath,
			now: () => new Date("2026-06-17T12:00:00.000Z"),
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () => createMockClient({ session: runtimeSession, statuses: {} }),
			getSessionBinding: () =>
				createBinding({
					status: "released",
					releasedAt: Date.UTC(2026, 5, 17, 12, 7, 0),
					updatedAt: Date.UTC(2026, 5, 17, 12, 7, 0),
				}),
			workingDirectory: "/repo",
		})

		const meta = service.createMetaSession({ title: "Meta root" })
		await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		const [child] = await service.listChildSessions(meta.id)
		expect(child.status).toBe("cancelled")
		expect(child.lastHeartbeatAt).toBe("2026-06-17T12:07:00.000Z")

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("runtime capabilities fail loud when OpenCode missing", () => {
		const storePath = createTempStorePath()
		const service = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => null,
		})

		const capabilities = service.getRuntimeCapabilities("opencode")
		expect(capabilities.status).toBe("unavailable")
		expect(capabilities.canCreateSession).toBe(false)
		expect(capabilities.blockers[0]?.message).toContain("OpenCode server URL unavailable")

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("invalid store fails loud instead of resetting", () => {
		const storePath = createTempStorePath()
		writeFileSync(storePath, "{ nope", "utf-8")
		const service = createPalotMetaSessionService({ storePath })

		expect(() => service.listMetaSessions()).toThrow(`Meta session store "${storePath}" is invalid`)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("unsupported runtime kinds and missing sessions throw typed errors", async () => {
		const storePath = createTempStorePath()
		const service = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () => createMockClient({ session: buildSession() }),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })

		expect(() => service.getMetaSession("meta_missing")).toThrow('Meta session "meta_missing" does not exist')

		await expect(
			service.createChildSession({
				parentSessionId: meta.id,
				runtimeKind: "codex",
				title: "Nope",
			}),
		).rejects.toMatchObject({
			code: "unsupported-runtime-kind",
		} satisfies Partial<PalotMetaSessionError>)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("missing runtime child session throws typed error instead of fake ready state", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		const writer = createPalotMetaSessionService({
			storePath,
			now: () => new Date("2026-06-17T12:00:00.000Z"),
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () => createMockClient({ session: runtimeSession }),
			workingDirectory: "/repo",
		})
		const meta = writer.createMetaSession({ title: "Meta root" })
		const child = await writer.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		const reader = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () => ({
				session: {
					create: async () => ({ data: runtimeSession }),
					get: async () => {
						throw new Error("missing runtime session")
					},
					status: async () => ({ data: {} }),
				},
			}),
			workingDirectory: "/repo",
		})

		await expect(reader.getChildSession(meta.id, child.id)).rejects.toMatchObject({
			code: "runtime-session-not-found",
		} satisfies Partial<PalotMetaSessionError>)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})
})
