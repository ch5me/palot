import crypto from "node:crypto"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import {
	type ChildSession,
	type MetaSession,
	type MetaSessionStatus,
	type RuntimeBlocker,
	type RuntimeCapabilities,
	type RuntimeEventPage,
	type RuntimeKind,
} from "@ch5me/agent-runtime-contracts"
import type { Session, SessionStatus } from "@opencode-ai/sdk/v2/client"
import { z } from "zod"
import type { SessionBinding } from "../preload/api"
import { getConfigDir } from "./automation/paths"
import { createLogger } from "./logger"
import { getSessionBindingByOpenCodeSession } from "./palot-session-binding"

const log = createLogger("palot-meta-session")
const require = createRequire(import.meta.url)
const STORE_DIR = path.join(getConfigDir(), "opencode")
const STORE_FILE = path.join(STORE_DIR, "meta-sessions.json")
const STORE_VERSION = 1
const OPENCODE_RUNTIME_KIND = "opencode"
const DRY_RUN_RUNTIME_KINDS = ["codex", "claude-code"] as const

const nonEmptyStringSchema = z.string().min(1)
const isoDateTimeSchema = z.string().datetime({ offset: true, local: false })
const metaSessionStatusSchema = z.enum([
	"active",
	"idle",
	"blocked",
	"completed",
	"failed",
	"cancelled",
])
const runtimeKindSchema = z.enum(["opencode", "claude-code", "codex"])
const metaSessionSchema = z
	.object({
		id: nonEmptyStringSchema,
		parentSessionId: nonEmptyStringSchema.optional(),
		title: nonEmptyStringSchema,
		createdAt: isoDateTimeSchema,
		updatedAt: isoDateTimeSchema,
		status: metaSessionStatusSchema,
	})
	.strict()
const childSessionSchema = z
	.object({
		id: nonEmptyStringSchema,
		parentSessionId: nonEmptyStringSchema,
		runtimeKind: runtimeKindSchema,
		runtimeSessionId: nonEmptyStringSchema,
		title: nonEmptyStringSchema,
		status: metaSessionStatusSchema,
		createdAt: isoDateTimeSchema,
		lastHeartbeatAt: isoDateTimeSchema.optional(),
		lastEventAt: isoDateTimeSchema.optional(),
	})
	.strict()

const storedChildSessionSchema = z
	.object({
		session: childSessionSchema,
		workingDirectory: z.string().min(1),
		dryRunSummary: nonEmptyStringSchema.optional(),
	})
	.strict()

const metaSessionStoreFileSchema = z
	.object({
		version: z.literal(STORE_VERSION),
		metaSessions: z.array(metaSessionSchema),
		childSessions: z.array(storedChildSessionSchema),
	})
	.strict()

type StoredChildSession = z.infer<typeof storedChildSessionSchema>
type MetaSessionStoreFile = z.infer<typeof metaSessionStoreFileSchema>

export type PalotMetaSessionErrorCode =
	| "unsupported-runtime-kind"
	| "unsupported-runtime-operation"
	| "meta-session-not-found"
	| "child-session-not-found"
	| "runtime-session-not-found"
	| "opencode-server-missing"
	| "opencode-client-missing"
	| "opencode-response-invalid"
	| "meta-session-store-invalid"

export type PalotMetaSessionError = Error & {
	code: PalotMetaSessionErrorCode
	details?: string
	metaSessionId?: string
	childSessionId?: string
	runtimeKind?: string
	runtimeSessionId?: string
	operation?: string
	blocker?: RuntimeBlocker
}

interface MetaSessionClient {
	session: {
		create(args: { title: string }): Promise<{ data: unknown }>
		get(args: { sessionID: string }): Promise<{ data: unknown }>
		status(args: { directory?: string }): Promise<{ data: unknown }>
	}
}

function defaultGetServerUrl(): string | null {
	const mod = require("./opencode-manager") as {
		getServerUrl: () => string | null
	}
	return mod.getServerUrl()
}

function defaultCreateClient(directory: string): MetaSessionClient | null {
	const mod = require("./automation/opencode-client") as {
		createAutomationClient: (workingDirectory: string) => MetaSessionClient | null
	}
	return mod.createAutomationClient(directory)
}

interface CreateMetaSessionInput {
	title: string
	parentSessionId?: string
}

interface CreateChildSessionInput {
	parentSessionId: string
	runtimeKind: RuntimeKind
	title: string
	workingDirectory?: string
}

interface CreateChildSessionsInput {
	parentSessionId: string
	runtimes: RuntimeKind[]
	title: string
	workingDirectory?: string
}

interface PalotMetaSessionServiceDeps {
	now?: () => Date
	storePath?: string
	workingDirectory?: string
	getServerUrl?: () => string | null
	createClient?: (directory: string) => MetaSessionClient | null
	getSessionBinding?: (sessionId: string) => SessionBinding | null
}

export interface PalotMetaSessionService {
	createMetaSession(input: CreateMetaSessionInput): MetaSession
	listMetaSessions(): MetaSession[]
	getMetaSession(metaSessionId: string): MetaSession
	createChildSession(input: CreateChildSessionInput): Promise<ChildSession>
	createChildSessions(input: CreateChildSessionsInput): Promise<ChildSession[]>
	listChildSessions(metaSessionId: string): Promise<ChildSession[]>
	getChildSession(metaSessionId: string, childSessionId: string): Promise<ChildSession>
	readChildSessionEvents(
		metaSessionId: string,
		childSessionId: string,
		cursor?: string,
	): Promise<RuntimeEventPage>
	sendChildSessionPrompt(metaSessionId: string, childSessionId: string, prompt: string): Promise<never>
	cancelChildSession(metaSessionId: string, childSessionId: string, reason: string): Promise<never>
	listChildSessionArtifacts(metaSessionId: string, childSessionId: string): Promise<never>
	getRuntimeCapabilities(runtimeKind: RuntimeKind): RuntimeCapabilities
	getStorePath(): string
}

function createMetaSessionError(
	code: PalotMetaSessionErrorCode,
	message: string,
	extra: Partial<PalotMetaSessionError> = {},
): PalotMetaSessionError {
	return Object.assign(new Error(message), {
		name: "PalotMetaSessionError",
		code,
		...extra,
	})
}

export function isPalotMetaSessionError(error: unknown): error is PalotMetaSessionError {
	return error instanceof Error && "code" in error
}

function ensureStoreDir(storePath: string): void {
	fs.mkdirSync(path.dirname(storePath), { recursive: true })
}

function readStoreFile(storePath: string): MetaSessionStoreFile {
	ensureStoreDir(storePath)
	if (!fs.existsSync(storePath)) {
		return {
			version: STORE_VERSION,
			metaSessions: [],
			childSessions: [],
		}
	}
	try {
		const raw = JSON.parse(fs.readFileSync(storePath, "utf-8"))
		return metaSessionStoreFileSchema.parse(raw)
	} catch (error) {
		log.error("Meta session store invalid", {
			storeFile: storePath,
			error: error instanceof Error ? error.message : String(error),
		})
		throw createMetaSessionError(
			"meta-session-store-invalid",
			`Meta session store "${storePath}" is invalid`,
			{ details: error instanceof Error ? error.message : String(error) },
		)
	}
}

function writeStoreFile(storePath: string, store: MetaSessionStoreFile): void {
	ensureStoreDir(storePath)
	const tmpPath = `${storePath}.tmp`
	fs.writeFileSync(tmpPath, JSON.stringify(store, null, "\t"), "utf-8")
	fs.renameSync(tmpPath, storePath)
}

function toIsoString(date: Date): string {
	return date.toISOString()
}

function toIsoFromMillis(value: number | undefined | null): string | undefined {
	if (typeof value !== "number" || !Number.isFinite(value)) return undefined
	return new Date(value).toISOString()
}

function parseRuntimeSession(data: unknown, runtimeSessionId: string): Session {
	const session = data as Partial<Session> | undefined
	if (
		!session?.id ||
		typeof session.title !== "string" ||
		typeof session.time?.created !== "number" ||
		typeof session.time?.updated !== "number"
	) {
		throw createMetaSessionError(
			"opencode-response-invalid",
			`OpenCode returned invalid session payload for ${runtimeSessionId}`,
			{ runtimeKind: OPENCODE_RUNTIME_KIND, runtimeSessionId },
		)
	}
	return session as Session
}

function parseRuntimeStatuses(data: unknown): Record<string, SessionStatus> {
	if (!data || typeof data !== "object" || Array.isArray(data)) return {}
	return data as Record<string, SessionStatus>
}

function mapOpenCodeStatus(
	runtimeStatus: SessionStatus | undefined,
	binding: SessionBinding | null,
	fallbackStatus: MetaSessionStatus,
): MetaSessionStatus {
	if (runtimeStatus?.type === "busy") return "active"
	if (runtimeStatus?.type === "retry") return "blocked"
	if (runtimeStatus?.type === "idle") return "idle"

	if (binding?.status === "released") return "cancelled"
	if (binding?.status === "attaching") return "active"
	if (binding?.status === "attached" || binding?.status === "restored") return "idle"

	return fallbackStatus
}

function isDryRunRuntimeKind(
	runtimeKind: RuntimeKind,
): runtimeKind is (typeof DRY_RUN_RUNTIME_KINDS)[number] {
	return DRY_RUN_RUNTIME_KINDS.includes(runtimeKind as (typeof DRY_RUN_RUNTIME_KINDS)[number])
}

function assertSupportedRuntimeKind(runtimeKind: RuntimeKind): void {
	if (runtimeKind === OPENCODE_RUNTIME_KIND || isDryRunRuntimeKind(runtimeKind)) return
	throw createMetaSessionError(
		"unsupported-runtime-kind",
		`Palot meta-session foundation does not support runtime kind "${runtimeKind}" yet`,
		{ runtimeKind },
	)
}

function findMetaSessionOrThrow(store: MetaSessionStoreFile, metaSessionId: string): MetaSession {
	const metaSession = store.metaSessions.find((entry) => entry.id === metaSessionId)
	if (!metaSession) {
		throw createMetaSessionError(
			"meta-session-not-found",
			`Meta session "${metaSessionId}" does not exist`,
			{ metaSessionId },
		)
	}
	return metaSession
}

function buildChildSessionId(runtimeKind: RuntimeKind, runtimeSessionId: string): string {
	return `${runtimeKind}:${runtimeSessionId}`
}

function buildDryRunRuntimeSessionId(runtimeKind: RuntimeKind): string {
	return `dryrun_${runtimeKind.replace(/-/g, "_")}_${crypto.randomUUID()}`
}

function buildUnsupportedOperationBlocker(
	runtimeKind: RuntimeKind,
	operation: "send" | "cancel" | "artifacts",
): RuntimeBlocker {
	const operationMessage = {
		send: "Send prompts unsupported in Wave 3 dry-run foundation",
		cancel: "Cancel unsupported in Wave 3 dry-run foundation",
		artifacts: "Artifacts unsupported in Wave 3 dry-run foundation",
	} as const

	return {
		code: "unsupported-operation",
		scope: "session",
		message: operationMessage[operation],
		retryable: false,
		details: `${runtimeKind} adapter is create/read only in this wave. Mutation authority stays disabled.`,
	}
}

function throwUnsupportedOperation(
	runtimeKind: RuntimeKind,
	childSessionId: string,
	operation: "send" | "cancel" | "artifacts",
): never {
	const blocker = buildUnsupportedOperationBlocker(runtimeKind, operation)
	throw createMetaSessionError(
		"unsupported-runtime-operation",
		`${runtimeKind} child "${childSessionId}" does not support ${operation} in Wave 3 dry-run mode`,
		{
			runtimeKind,
			childSessionId,
			operation,
			blocker,
		},
	)
}

function mapMetaStatusToRuntimeStatus(
	status: MetaSessionStatus,
): RuntimeCapabilities["status"] {
	switch (status) {
		case "active":
			return "busy"
		case "blocked":
			return "blocked"
		case "completed":
		case "failed":
		case "cancelled":
			return "offline"
		case "idle":
		default:
			return "ready"
	}
}

function buildRuntimeEventId(childSessionId: string, suffix: string): string {
	return `${childSessionId}:${suffix}`
}

function updateMetaSessionTimestamp(
	store: MetaSessionStoreFile,
	metaSessionId: string,
	updatedAt: string,
): void {
	store.metaSessions = store.metaSessions.map((entry) =>
		entry.id === metaSessionId ? metaSessionSchema.parse({ ...entry, updatedAt }) : entry,
	)
}

export function createPalotMetaSessionService(
	deps: PalotMetaSessionServiceDeps = {},
): PalotMetaSessionService {
	const storePath = deps.storePath ?? STORE_FILE
	const now = deps.now ?? (() => new Date())
	const resolveServerUrl = deps.getServerUrl ?? defaultGetServerUrl
	const createClient = deps.createClient ?? defaultCreateClient
	const resolveBinding = deps.getSessionBinding ?? getSessionBindingByOpenCodeSession
	const defaultWorkingDirectory = deps.workingDirectory ?? process.cwd()

	function requireOpenCodeServerUrl(): string {
		const serverUrl = resolveServerUrl()
		if (!serverUrl) {
			throw createMetaSessionError(
				"opencode-server-missing",
				"OpenCode server URL unavailable. Start managed or external OpenCode first.",
				{ runtimeKind: OPENCODE_RUNTIME_KIND },
			)
		}
		return serverUrl
	}

	function requireOpenCodeClient(directory: string): MetaSessionClient {
		const client = createClient(directory)
		if (!client) {
			throw createMetaSessionError(
				"opencode-client-missing",
				`OpenCode client unavailable for directory "${directory}"`,
				{ runtimeKind: OPENCODE_RUNTIME_KIND },
			)
		}
		return client
	}

	async function hydrateChildSessionRecord(record: StoredChildSession): Promise<StoredChildSession> {
		assertSupportedRuntimeKind(record.session.runtimeKind)
		if (isDryRunRuntimeKind(record.session.runtimeKind)) {
			const timestamp = record.session.lastEventAt ?? record.session.lastHeartbeatAt ?? record.session.createdAt
			return storedChildSessionSchema.parse({
				...record,
				session: {
					...record.session,
					lastHeartbeatAt: record.session.lastHeartbeatAt ?? timestamp,
					lastEventAt: record.session.lastEventAt ?? timestamp,
				},
			})
		}
		requireOpenCodeServerUrl()
		const client = requireOpenCodeClient(record.workingDirectory)

		let sessionInfo: Session
		try {
			const result = await client.session.get({ sessionID: record.session.runtimeSessionId })
			sessionInfo = parseRuntimeSession(result.data, record.session.runtimeSessionId)
		} catch (error) {
			if (isPalotMetaSessionError(error)) throw error
			throw createMetaSessionError(
				"runtime-session-not-found",
				`OpenCode session "${record.session.runtimeSessionId}" is unavailable`,
				{
					runtimeKind: record.session.runtimeKind,
					runtimeSessionId: record.session.runtimeSessionId,
					childSessionId: record.session.id,
				},
			)
		}

		const statuses = parseRuntimeStatuses(
			(await client.session.status({ directory: record.workingDirectory })).data,
		)
		const runtimeStatus = statuses[record.session.runtimeSessionId]
		const binding = resolveBinding(record.session.runtimeSessionId)
		const bindingIso = toIsoFromMillis(binding?.updatedAt)
		const sessionUpdatedIso = toIsoFromMillis(sessionInfo.time.updated)
		const lastSeenIso = bindingIso ?? sessionUpdatedIso

		return storedChildSessionSchema.parse({
			...record,
			session: {
				...record.session,
				title: sessionInfo.title,
				createdAt: toIsoFromMillis(sessionInfo.time.created) ?? record.session.createdAt,
				status: mapOpenCodeStatus(runtimeStatus, binding, record.session.status),
				lastHeartbeatAt: lastSeenIso,
				lastEventAt: sessionUpdatedIso ?? lastSeenIso,
			},
		})
	}

	function findChildSessionRecordOrThrow(
		store: MetaSessionStoreFile,
		metaSessionId: string,
		childSessionId: string,
	): StoredChildSession {
		findMetaSessionOrThrow(store, metaSessionId)
		const record = store.childSessions.find(
			(entry) =>
				entry.session.parentSessionId === metaSessionId && entry.session.id === childSessionId,
		)
		if (!record) {
			throw createMetaSessionError(
				"child-session-not-found",
				`Child session "${childSessionId}" does not exist under meta session "${metaSessionId}"`,
				{ metaSessionId, childSessionId },
			)
		}
		return record
	}

	function createDryRunChildSessionRecord(
		input: CreateChildSessionInput,
		workingDirectory: string,
		createdAt: Date,
	): StoredChildSession {
		const createdAtIso = toIsoString(createdAt)
		const runtimeSessionId = buildDryRunRuntimeSessionId(input.runtimeKind)
		return storedChildSessionSchema.parse({
			session: {
				id: buildChildSessionId(input.runtimeKind, runtimeSessionId),
				parentSessionId: input.parentSessionId,
				runtimeKind: input.runtimeKind,
				runtimeSessionId,
				title: input.title,
				status: "idle",
				createdAt: createdAtIso,
				lastHeartbeatAt: createdAtIso,
				lastEventAt: createdAtIso,
			},
			workingDirectory,
			dryRunSummary: `${input.runtimeKind} dry-run child reserved. Native session id placeholder only. Send/cancel/artifacts stay blocked in Wave 3.`,
		})
	}

	function buildReadOnlyCapabilities(runtimeKind: RuntimeKind): RuntimeCapabilities {
		return {
			runtimeKind,
			status: "ready",
			canCreateSession: true,
			canSendPrompt: false,
			canReadEvents: true,
			canCancel: false,
			canListArtifacts: false,
			canEvaluatePolicy: false,
			blockers: [
				buildUnsupportedOperationBlocker(runtimeKind, "send"),
				buildUnsupportedOperationBlocker(runtimeKind, "cancel"),
				buildUnsupportedOperationBlocker(runtimeKind, "artifacts"),
			],
		}
	}

	async function buildRuntimeEventPage(record: StoredChildSession): Promise<RuntimeEventPage> {
		const hydrated = await hydrateChildSessionRecord(record)
		const occurredAt =
			hydrated.session.lastEventAt ?? hydrated.session.lastHeartbeatAt ?? hydrated.session.createdAt
		const runtimeStatus = mapMetaStatusToRuntimeStatus(hydrated.session.status)
		const events: RuntimeEventPage["events"] = [
			{
				eventId: buildRuntimeEventId(hydrated.session.id, "status"),
				type: "session.status",
				childSessionId: hydrated.session.id,
				runtimeKind: hydrated.session.runtimeKind,
				occurredAt,
				status: hydrated.session.status,
				runtimeStatus,
			},
		]

		if (hydrated.dryRunSummary) {
			events.push({
				eventId: buildRuntimeEventId(hydrated.session.id, "summary"),
				type: "message",
				childSessionId: hydrated.session.id,
				runtimeKind: hydrated.session.runtimeKind,
				occurredAt,
				role: "assistant",
				text: hydrated.dryRunSummary,
			})
			for (const operation of ["send", "cancel", "artifacts"] as const) {
				events.push({
					eventId: buildRuntimeEventId(hydrated.session.id, `blocker:${operation}`),
					type: "blocker",
					childSessionId: hydrated.session.id,
					runtimeKind: hydrated.session.runtimeKind,
					occurredAt,
					blocker: buildUnsupportedOperationBlocker(hydrated.session.runtimeKind, operation),
				})
			}
		} else {
			events.push({
				eventId: buildRuntimeEventId(hydrated.session.id, "summary"),
				type: "message",
				childSessionId: hydrated.session.id,
				runtimeKind: hydrated.session.runtimeKind,
				occurredAt,
				role: "assistant",
				text: `OpenCode child attached to runtime session ${hydrated.session.runtimeSessionId}.`,
			})
		}

		return {
			events,
		}
	}

	async function createSingleChildSession(input: CreateChildSessionInput): Promise<ChildSession> {
		assertSupportedRuntimeKind(input.runtimeKind)
		const workingDirectory = input.workingDirectory ?? defaultWorkingDirectory
		const store = readStoreFile(storePath)
		findMetaSessionOrThrow(store, input.parentSessionId)
		const createdAt = now()
		const record = isDryRunRuntimeKind(input.runtimeKind)
			? createDryRunChildSessionRecord(input, workingDirectory, createdAt)
			: await (async () => {
					requireOpenCodeServerUrl()
					const client = requireOpenCodeClient(workingDirectory)
					const createResult = await client.session.create({ title: input.title })
					const runtimeSession = parseRuntimeSession(createResult.data, input.title)
					return storedChildSessionSchema.parse({
						session: {
							id: buildChildSessionId(input.runtimeKind, runtimeSession.id),
							parentSessionId: input.parentSessionId,
							runtimeKind: input.runtimeKind,
							runtimeSessionId: runtimeSession.id,
							title: runtimeSession.title,
							status: "idle",
							createdAt:
								toIsoFromMillis(runtimeSession.time.created) ?? toIsoString(createdAt),
						},
						workingDirectory,
					})
				})()

		store.childSessions.push(record)
		updateMetaSessionTimestamp(store, input.parentSessionId, toIsoString(createdAt))
		writeStoreFile(storePath, store)

		const hydrated = await hydrateChildSessionRecord(record)
		const nextStore = readStoreFile(storePath)
		nextStore.childSessions = nextStore.childSessions.map((entry) =>
			entry.session.id === hydrated.session.id ? hydrated : entry,
		)
		writeStoreFile(storePath, nextStore)
		return hydrated.session
	}

	return {
		createMetaSession(input) {
			const timestamp = toIsoString(now())
			const store = readStoreFile(storePath)
			const next = metaSessionSchema.parse({
				id: `meta_${crypto.randomUUID()}`,
				parentSessionId: input.parentSessionId,
				title: input.title,
				createdAt: timestamp,
				updatedAt: timestamp,
				status: "active",
			})

			store.metaSessions.push(next)
			writeStoreFile(storePath, store)
			return next
		},

		listMetaSessions() {
			return readStoreFile(storePath).metaSessions
		},

		getMetaSession(metaSessionId) {
			return findMetaSessionOrThrow(readStoreFile(storePath), metaSessionId)
		},

		async createChildSession(input) {
			return createSingleChildSession(input)
		},

		async createChildSessions(input) {
			const children: ChildSession[] = []
			for (const runtimeKind of input.runtimes) {
				children.push(
					await createSingleChildSession({
						parentSessionId: input.parentSessionId,
						runtimeKind,
						title: input.title,
						workingDirectory: input.workingDirectory,
					}),
				)
			}
			return children
		},

		async listChildSessions(metaSessionId) {
			const store = readStoreFile(storePath)
			findMetaSessionOrThrow(store, metaSessionId)
			const children = store.childSessions.filter((entry) => entry.session.parentSessionId === metaSessionId)
			const hydrated = await Promise.all(children.map((entry) => hydrateChildSessionRecord(entry)))
			store.childSessions = store.childSessions.map((entry) => {
				const next = hydrated.find((candidate) => candidate.session.id === entry.session.id)
				return next ?? entry
			})
			writeStoreFile(storePath, store)
			return hydrated.map((entry) => entry.session)
		},

		async getChildSession(metaSessionId, childSessionId) {
			const store = readStoreFile(storePath)
			const record = findChildSessionRecordOrThrow(store, metaSessionId, childSessionId)
			const hydrated = await hydrateChildSessionRecord(record)
			store.childSessions = store.childSessions.map((entry) =>
				entry.session.id === hydrated.session.id ? hydrated : entry,
			)
			writeStoreFile(storePath, store)
			return hydrated.session
		},

		async readChildSessionEvents(metaSessionId, childSessionId) {
			const store = readStoreFile(storePath)
			const record = findChildSessionRecordOrThrow(store, metaSessionId, childSessionId)
			const hydrated = await hydrateChildSessionRecord(record)
			store.childSessions = store.childSessions.map((entry) =>
				entry.session.id === hydrated.session.id ? hydrated : entry,
			)
			writeStoreFile(storePath, store)
			return buildRuntimeEventPage(hydrated)
		},

		async sendChildSessionPrompt(metaSessionId, childSessionId) {
			const store = readStoreFile(storePath)
			const record = findChildSessionRecordOrThrow(store, metaSessionId, childSessionId)
			throwUnsupportedOperation(record.session.runtimeKind, record.session.id, "send")
		},

		async cancelChildSession(metaSessionId, childSessionId) {
			const store = readStoreFile(storePath)
			const record = findChildSessionRecordOrThrow(store, metaSessionId, childSessionId)
			throwUnsupportedOperation(record.session.runtimeKind, record.session.id, "cancel")
		},

		async listChildSessionArtifacts(metaSessionId, childSessionId) {
			const store = readStoreFile(storePath)
			const record = findChildSessionRecordOrThrow(store, metaSessionId, childSessionId)
			throwUnsupportedOperation(record.session.runtimeKind, record.session.id, "artifacts")
		},

		getRuntimeCapabilities(runtimeKind) {
			assertSupportedRuntimeKind(runtimeKind)
			if (isDryRunRuntimeKind(runtimeKind)) {
				return buildReadOnlyCapabilities(runtimeKind)
			}
			const serverUrl = resolveServerUrl()
			if (!serverUrl) {
				return {
					runtimeKind,
					status: "unavailable",
					canCreateSession: false,
					canSendPrompt: false,
					canReadEvents: false,
					canCancel: false,
					canListArtifacts: false,
					canEvaluatePolicy: false,
					blockers: [
						{
							code: "missing-precondition",
							scope: "runtime",
							message: "OpenCode server URL unavailable",
							retryable: true,
							details: "Start Palot-managed or external OpenCode before creating meta child sessions.",
						},
					],
				}
			}

			if (!createClient(defaultWorkingDirectory)) {
				return {
					runtimeKind,
					status: "unavailable",
					canCreateSession: false,
					canSendPrompt: false,
					canReadEvents: false,
					canCancel: false,
					canListArtifacts: false,
					canEvaluatePolicy: false,
					blockers: [
						{
							code: "missing-precondition",
							scope: "runtime",
							message: `OpenCode client unavailable for "${defaultWorkingDirectory}"`,
							retryable: true,
							details: "Create Automation client through Palot's OpenCode bridge before using meta sessions.",
						},
					],
				}
			}

			return {
				...buildReadOnlyCapabilities(runtimeKind),
			}
		},

		getStorePath() {
			return storePath
		},
	}
}
