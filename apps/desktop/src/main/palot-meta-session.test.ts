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
	statusData?: unknown
	onPromptAsync?: (args: {
		sessionID: string
		parts: Array<{ type: "text"; text: string }>
	}) => void | Promise<void>
	onAbort?: (args: { sessionID: string }) => void | Promise<void>
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
				data: options.statusData ?? options.statuses ?? {},
			}),
			promptAsync: async (args: {
				sessionID: string
				parts: Array<{ type: "text"; text: string }>
			}) => {
				await options.onPromptAsync?.(args)
				return { data: null }
			},
			abort: async (args: { sessionID: string }) => {
				await options.onAbort?.(args)
				return { data: null }
			},
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

	test("batch child create dispatches OpenCode plus dry-run Codex and Claude children", async () => {
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
		const children = await service.createChildSessions({
			parentSessionId: meta.id,
			runtimes: ["opencode", "codex", "claude-code"],
			title: "Compare runtimes",
		})

		expect(children.map((child) => child.runtimeKind)).toEqual([
			"opencode",
			"codex",
			"claude-code",
		])
		expect(children[0]?.runtimeSessionId).toBe(runtimeSession.id)
		expect(children[0]?.status).toBe("active")
		expect(children[1]?.runtimeSessionId).toMatch(/^dryrun_codex_/)
		expect(children[1]?.status).toBe("idle")
		expect(children[2]?.runtimeSessionId).toMatch(/^dryrun_claude_code_/)
		expect(children[2]?.status).toBe("idle")

		const listed = await service.listChildSessions(meta.id)
		expect(listed).toHaveLength(3)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("invalid store fails loud instead of resetting", () => {
		const storePath = createTempStorePath()
		writeFileSync(storePath, "{ nope", "utf-8")
		const service = createPalotMetaSessionService({ storePath })

		expect(() => service.listMetaSessions()).toThrow(`Meta session store "${storePath}" is invalid`)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("missing sessions throw typed errors", async () => {
		const storePath = createTempStorePath()
		const service = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () => createMockClient({ session: buildSession() }),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })

		expect(() => service.getMetaSession("meta_missing")).toThrow('Meta session "meta_missing" does not exist')

		await expect(service.getChildSession(meta.id, "codex:missing")).rejects.toMatchObject({
			code: "child-session-not-found",
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
					promptAsync: async () => ({ data: null }),
					abort: async () => ({ data: null }),
				},
			}),
			workingDirectory: "/repo",
		})

		await expect(reader.getChildSession(meta.id, child.id)).rejects.toMatchObject({
			code: "runtime-session-not-found",
		} satisfies Partial<PalotMetaSessionError>)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("invalid runtime status payload fails loud instead of falling back", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		const service = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statuses: {
						[runtimeSession.id]: { type: "idle" },
					},
				}),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})
		const reader = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statusData: {
						[runtimeSession.id]: { state: "busy" },
					},
				}),
			workingDirectory: "/repo",
		})

		await expect(reader.getChildSession(meta.id, child.id)).rejects.toMatchObject({
			code: "opencode-response-invalid",
		})

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("partial retry runtime status fails loud", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		const service = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statuses: {
						[runtimeSession.id]: { type: "idle" },
					},
				}),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})
		const reader = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statusData: {
						[runtimeSession.id]: { type: "retry" },
					},
				}),
			workingDirectory: "/repo",
		})

		await expect(reader.getChildSession(meta.id, child.id)).rejects.toMatchObject({
			code: "opencode-response-invalid",
		})

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("denied policy never reaches prompt adapter path", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		let promptCalls = 0
		const service = createPalotMetaSessionService({
			storePath,
			now: () => new Date("2026-06-17T12:00:00.000Z"),
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statuses: {
						[runtimeSession.id]: { type: "idle" },
					},
					onPromptAsync: () => {
						promptCalls += 1
					},
				}),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		const verdict = await service.sendChildSessionPrompt(meta.id, child.id, "ship it", {
			policyMode: "dry-run",
		})

		expect(verdict).toMatchObject({
			mode: "dry-run",
			decision: "deny",
		})
		expect(promptCalls).toBe(0)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("invalid policy mode fails before adapter mutation", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		let promptCalls = 0
		const service = createPalotMetaSessionService({
			storePath,
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statuses: {
						[runtimeSession.id]: { type: "idle" },
					},
					onPromptAsync: () => {
						promptCalls += 1
					},
				}),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		await expect(
			service.sendChildSessionPrompt(meta.id, child.id, "ship it", {
				policyMode: "invalid",
				approvalId: "approval_meta_123",
			} as unknown as Parameters<typeof service.sendChildSessionPrompt>[3]),
		).rejects.toMatchObject({
			code: "opencode-response-invalid",
		})
		expect(promptCalls).toBe(0)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("ask policy logs visible approval gate without adapter mutation", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		let promptCalls = 0
		const service = createPalotMetaSessionService({
			storePath,
			now: () => new Date("2026-06-17T12:00:00.000Z"),
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statuses: {
						[runtimeSession.id]: { type: "idle" },
					},
					onPromptAsync: () => {
						promptCalls += 1
					},
				}),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		const verdict = await service.evaluateChildSessionPolicy(meta.id, child.id, "send", {
			policyMode: "ask",
		})
		const eventPage = await service.readChildSessionEvents(meta.id, child.id)
		const blockedChild = await service.getChildSession(meta.id, child.id)
		const policyEvent = eventPage.events.find((event) => event.type === "policy")

		expect(verdict).toMatchObject({
			mode: "ask",
			decision: "ask",
		})
		expect(promptCalls).toBe(0)
		expect(blockedChild.status).toBe("blocked")
		expect(policyEvent).toMatchObject({
			type: "policy",
			verdict: expect.objectContaining({
				mode: "ask",
				decision: "ask",
			}),
		})

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("approved send carries adapter dispatch permission into event log", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		const promptPayloads: string[] = []
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
					onPromptAsync: (args) => {
						promptPayloads.push(args.parts.map((part) => part.text).join("\n"))
					},
				}),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		const verdict = await service.sendChildSessionPrompt(meta.id, child.id, "ship it", {
			policyMode: "enforce",
			approvalId: "approval_meta_123",
			approvedBy: "Chris",
		})
		const eventPage = await service.readChildSessionEvents(meta.id, child.id)
		const policyEvent = eventPage.events.find((event) => event.type === "policy")
		const mutationEvent = eventPage.events.find(
			(event) => event.type === "message" && event.text.includes("send dispatched: ship it"),
		)

		expect(promptPayloads).toEqual(["ship it"])
		expect(verdict).toMatchObject({
			mode: "enforce",
			decision: "allow",
				adapterDispatchPermission: {
					approvalId: "approval_meta_123",
					approvedBy: "Chris",
					grantedBy: "Chris",
					operation: "send",
					target: {
						childSessionId: child.id,
						runtimeKind: "opencode",
						runtimeSessionId: runtimeSession.id,
					},
				},
			})
		expect(policyEvent).toMatchObject({
			type: "policy",
			verdict: expect.objectContaining({
				decision: "allow",
				adapterDispatchPermission: expect.objectContaining({
					approvalId: "approval_meta_123",
					approvedBy: "Chris",
					grantedBy: "Chris",
					operation: "send",
					target: expect.objectContaining({
						childSessionId: child.id,
						runtimeKind: "opencode",
						runtimeSessionId: runtimeSession.id,
					}),
				}),
			}),
		})
		expect(mutationEvent).toBeDefined()

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("enforce policy denies approvedBy without approval id", async () => {
		const storePath = createTempStorePath()
		const runtimeSession = buildSession()
		let promptCalls = 0
		const service = createPalotMetaSessionService({
			storePath,
			now: () => new Date("2026-06-17T12:00:00.000Z"),
			getServerUrl: () => "http://127.0.0.1:4096",
			createClient: () =>
				createMockClient({
					session: runtimeSession,
					statuses: {
						[runtimeSession.id]: { type: "idle" },
					},
					onPromptAsync: () => {
						promptCalls += 1
					},
				}),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		const verdict = await service.sendChildSessionPrompt(meta.id, child.id, "ship it", {
			policyMode: "enforce",
			approvedBy: "Chris",
		})

		expect(verdict).toMatchObject({
			mode: "enforce",
			decision: "deny",
			reason: "send denied because approval id is missing",
		})
		expect(promptCalls).toBe(0)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("child session events page with explicit cursors", async () => {
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
						[runtimeSession.id]: { type: "idle" },
					},
				}),
			workingDirectory: "/repo",
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "opencode",
			title: "OpenCode child",
		})

		for (let index = 0; index < 55; index += 1) {
			await service.evaluateChildSessionPolicy(meta.id, child.id, "send", {
				policyMode: "dry-run",
			})
		}

		const firstPage = await service.readChildSessionEvents(meta.id, child.id)
		const secondPage = await service.readChildSessionEvents(meta.id, child.id, firstPage.nextCursor)

		expect(firstPage.events).toHaveLength(50)
		expect(firstPage.nextCursor).toBe("50")
		expect(secondPage.events.length).toBeGreaterThan(0)
		expect(secondPage.nextCursor).toBeUndefined()
		await expect(service.readChildSessionEvents(meta.id, child.id, "10junk")).rejects.toMatchObject({
			code: "opencode-response-invalid",
		})

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("dry-run capabilities expose create/read only with explicit blockers", () => {
		const storePath = createTempStorePath()
		const service = createPalotMetaSessionService({ storePath })

		for (const runtimeKind of ["codex", "claude-code"] as const) {
			const capabilities = service.getRuntimeCapabilities(runtimeKind)
			expect(capabilities.status).toBe("ready")
			expect(capabilities.canCreateSession).toBe(true)
			expect(capabilities.canReadEvents).toBe(true)
			expect(capabilities.canSendPrompt).toBe(false)
			expect(capabilities.canCancel).toBe(false)
			expect(capabilities.canListArtifacts).toBe(false)
			expect(capabilities.blockers.map((blocker) => blocker.code)).toEqual([
				"unsupported-operation",
				"unsupported-operation",
				"unsupported-operation",
			])
		}

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})

	test("dry-run read events and mutation paths fail loud with typed blocker", async () => {
		const storePath = createTempStorePath()
		const service = createPalotMetaSessionService({
			storePath,
			now: () => new Date("2026-06-17T12:00:00.000Z"),
		})
		const meta = service.createMetaSession({ title: "Meta root" })
		const child = await service.createChildSession({
			parentSessionId: meta.id,
			runtimeKind: "codex",
			title: "Codex dry-run",
		})

		const eventPage = await service.readChildSessionEvents(meta.id, child.id)
		expect(eventPage.events.map((event) => event.type)).toEqual([
			"session.status",
			"message",
			"blocker",
			"blocker",
			"blocker",
		])
		expect(eventPage.events[1]).toMatchObject({
			type: "message",
			text: expect.stringContaining("dry-run child reserved"),
		})

		const sendVerdict = await service.sendChildSessionPrompt(meta.id, child.id, "ship it", {
			policyMode: "enforce",
			approvalId: "approval_meta_123",
		})
		expect(sendVerdict).toMatchObject({
			mode: "enforce",
			decision: "deny",
			blockers: [expect.objectContaining({ code: "unsupported-operation" })],
		})

		const cancelVerdict = await service.cancelChildSession(meta.id, child.id, "stop", {
			policyMode: "enforce",
			approvalId: "approval_meta_123",
		})
		expect(cancelVerdict).toMatchObject({
			mode: "enforce",
			decision: "deny",
		})

		await expect(service.listChildSessionArtifacts(meta.id, child.id)).rejects.toMatchObject({
			code: "unsupported-runtime-operation",
			operation: "artifacts",
		} satisfies Partial<PalotMetaSessionError>)

		rmSync(path.dirname(storePath), { recursive: true, force: true })
	})
})
