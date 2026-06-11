import type { SessionGenUiArtifactsState } from "../../renderer/atoms/genui-artifacts"
import type { GenUiArtifactRecord } from "../../renderer/lib/types"
import { getArtifactStore } from "./artifact-store"

export const GENUI_LOCALSTORAGE_KEY = "elf:genui-artifacts"

export interface LocalStorageLike {
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}

function normalizeRecord(record: GenUiArtifactRecord): GenUiArtifactRecord {
	return {
		...record,
		version: record.version ?? 1,
		dirty: record.dirty ?? [],
		lastAgentPatchAt: record.lastAgentPatchAt ?? 0,
		lastHumanEditAt: record.lastHumanEditAt ?? 0,
		schemaVersion: 1,
	}
}

export function migrateLocalStorageArtifacts(storage: LocalStorageLike): { migrated: number; sessions: number } {
	const raw = storage.getItem(GENUI_LOCALSTORAGE_KEY)
	if (!raw) return { migrated: 0, sessions: 0 }
	const parsed = JSON.parse(raw) as Record<string, SessionGenUiArtifactsState>
	const store = getArtifactStore()
	let migrated = 0
	for (const [sessionId, state] of Object.entries(parsed)) {
		for (const artifactId of state.order) {
			const record = state.records[artifactId]
			if (!record) continue
			store.upsertArtifact(sessionId, normalizeRecord(record))
			migrated += 1
		}
	}
	storage.removeItem(GENUI_LOCALSTORAGE_KEY)
	return { migrated, sessions: Object.keys(parsed).length }
}
