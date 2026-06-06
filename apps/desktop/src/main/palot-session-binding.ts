import fs from "node:fs"
import path from "node:path"
import type {
	SessionBinding,
	SessionBindingAuthority,
	SessionBindingRecord,
	SessionBindingStatus,
	SessionBindingStoreFile,
} from "../preload/api"
import { getConfigDir } from "./automation/paths"
import { createLogger } from "./logger"

const log = createLogger("palot-session-binding")
const STORE_DIR = path.join(getConfigDir(), "opencode")
const STORE_FILE = path.join(STORE_DIR, "session-bindings.json")

export const SESSION_BINDING_AUTHORITY_CONTRACT = {
	agentAuthority: "OpenCode session id",
	browserAuthority: "Magic Browser session id",
	transportAuthority: "Browser lane id",
	visualizationAuthority: "Overlay event stream",
	derivedFields: ["viewerUrl", "laneHealth", "currentUrl"],
} as const

function ensureStoreDir(): void {
	fs.mkdirSync(STORE_DIR, { recursive: true })
}

function readStoreFile(): SessionBindingStoreFile {
	ensureStoreDir()
	if (!fs.existsSync(STORE_FILE)) {
		return { version: 1, bindings: [] }
	}
	const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf-8")) as SessionBindingStoreFile
	if (!Array.isArray(raw.bindings)) {
		return { version: 1, bindings: [] }
	}
	return { version: 1, bindings: raw.bindings }
}

function writeStoreFile(store: SessionBindingStoreFile): void {
	ensureStoreDir()
	const tmpPath = `${STORE_FILE}.tmp`
	fs.writeFileSync(tmpPath, JSON.stringify(store, null, "\t"), "utf-8")
	fs.renameSync(tmpPath, STORE_FILE)
}

function toSessionBinding(record: SessionBindingRecord): SessionBinding {
	return { ...record }
}

function buildBindingId(openCodeSessionId: string): string {
	return `binding_${openCodeSessionId}`
}

export function createSessionBindingAuthority(
	authority: SessionBindingAuthority,
): SessionBindingAuthority {
	return {
		openCodeSessionId: authority.openCodeSessionId,
		browserLaneId: authority.browserLaneId,
		magicBrowserSessionId: authority.magicBrowserSessionId,
	}
}

export function createSessionBinding(input: {
	openCodeSessionId: string
	browserLaneId?: string | null
	magicBrowserSessionId?: string | null
	status?: SessionBindingStatus
	now?: number
}): SessionBinding {
	const now = input.now ?? Date.now()
	return {
		id: buildBindingId(input.openCodeSessionId),
		openCodeSessionId: input.openCodeSessionId,
		browserLaneId: input.browserLaneId ?? null,
		magicBrowserSessionId: input.magicBrowserSessionId ?? null,
		status: input.status ?? "unbound",
		createdAt: now,
		updatedAt: now,
		releasedAt: input.status === "released" ? now : null,
	}
}

export function getSessionBindingByOpenCodeSession(sessionId: string): SessionBinding | null {
	const record = readStoreFile().bindings.find((entry) => entry.openCodeSessionId === sessionId)
	return record ? toSessionBinding(record) : null
}

export function listSessionBindings(): SessionBinding[] {
	return readStoreFile().bindings.map(toSessionBinding)
}

export function upsertSessionBinding(binding: SessionBinding): SessionBinding {
	const store = readStoreFile()
	const nextRecord: SessionBindingRecord = {
		...binding,
		updatedAt: Date.now(),
		releasedAt: binding.status === "released" ? (binding.releasedAt ?? Date.now()) : null,
	}
	const index = store.bindings.findIndex((entry) => entry.openCodeSessionId === binding.openCodeSessionId)
	if (index === -1) {
		store.bindings.push(nextRecord)
	} else {
		store.bindings[index] = {
			...store.bindings[index],
			...nextRecord,
			createdAt: store.bindings[index]!.createdAt,
		}
	}
	writeStoreFile(store)
	log.info("Session binding persisted", {
		sessionId: binding.openCodeSessionId,
		status: nextRecord.status,
	})
	return toSessionBinding(nextRecord)
}

export function releaseSessionBinding(sessionId: string, now = Date.now()): SessionBinding | null {
	const existing = getSessionBindingByOpenCodeSession(sessionId)
	if (!existing) return null
	return upsertSessionBinding({
		...existing,
		status: "released",
		updatedAt: now,
		releasedAt: now,
	})
}

export function getSessionBindingStorePath(): string {
	return STORE_FILE
}
