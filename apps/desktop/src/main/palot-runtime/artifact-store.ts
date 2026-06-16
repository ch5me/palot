import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { getDataDir } from "../automation/paths"
import type { GenUiArtifactRecord } from "../../renderer/lib/types"
import { isArtifactId, mintArtifactId } from "../../shared/loom/artifact-id"

/**
 * Minimal synchronous SQLite surface shared by both runtime bindings.
 * node:sqlite's `DatabaseSync` and bun:sqlite's `Database` both satisfy it.
 */
interface SqliteStatement {
	all(...params: unknown[]): unknown[]
	get(...params: unknown[]): unknown
	run(...params: unknown[]): unknown
}
interface SqliteDatabase {
	exec(sql: string): void
	prepare(sql: string): SqliteStatement
	close(): void
}

/**
 * Resolve the SQLite binding for the active runtime:
 *   - Electron / Node main process → built-in `node:sqlite` (DatabaseSync)
 *   - Bun test runtime             → `bun:sqlite` (Database)
 * Both expose the same synchronous API, so the store code is identical
 * against either. We resolve via `createRequire` rather than a static
 * `import` so the unavailable builtin (node:sqlite isn't in Bun; bun:sqlite
 * isn't in Node, and a static `bun:` import crashes Electron's ESM loader)
 * is never referenced in a runtime that lacks it.
 */
const requireBuiltin = createRequire(import.meta.url)
const isBunRuntime = typeof (globalThis as { Bun?: unknown }).Bun !== "undefined"
const SqliteDatabaseCtor: new (filename: string) => SqliteDatabase = isBunRuntime
	? (requireBuiltin("bun:sqlite").Database as new (filename: string) => SqliteDatabase)
	: (requireBuiltin("node:sqlite").DatabaseSync as new (filename: string) => SqliteDatabase)

interface ArtifactRow {
	id: string
	sessionId: string
	orderIndex: number
	schemaVersion: number
	version: number
	title: string
	component: string
	props: string
	source: string
	pin: string
	createdAt: number
	updatedAt: number
	lastRenderedAt: number
	lastAgentPatchAt: number
	lastHumanEditAt: number
	dirty: string
}

export interface ArtifactListResult {
	order: string[]
	records: Record<string, GenUiArtifactRecord>
}

export interface ArtifactPatchInput {
	sessionId: string
	artifactId: string
	propsPatch?: Record<string, unknown>
	pin?: GenUiArtifactRecord["pin"]
	markDirty?: string[]
	lastAgentPatchAt?: number
	lastHumanEditAt?: number
	lastRenderedAt?: number
}

const ARTIFACT_SCHEMA_VERSION = 1
let artifactStore: ArtifactStore | null = null

function clone<T>(value: T): T {
	return structuredClone(value)
}

function getLoomDir(): string {
	return path.join(getDataDir(), "loom")
}

function getDatabasePath(): string {
	return path.join(getLoomDir(), "artifacts.sqlite")
}

function getJsonlPath(): string {
	return path.join(getLoomDir(), "artifacts.jsonl")
}

function ensureLoomDir(): void {
	fs.mkdirSync(getLoomDir(), { recursive: true })
}

function parseRow(row: ArtifactRow): GenUiArtifactRecord {
	return {
		id: row.id,
		scope: "session",
		title: row.title,
		component: row.component,
		props: JSON.parse(row.props) as Record<string, unknown>,
		source: JSON.parse(row.source) as GenUiArtifactRecord["source"],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		lastRenderedAt: row.lastRenderedAt,
		pin: JSON.parse(row.pin) as GenUiArtifactRecord["pin"],
		version: row.version,
		dirty: JSON.parse(row.dirty) as string[],
		lastAgentPatchAt: row.lastAgentPatchAt,
		lastHumanEditAt: row.lastHumanEditAt,
		schemaVersion: 1,
	}
}

function stringifyRecord(record: GenUiArtifactRecord, sessionId: string, orderIndex: number): ArtifactRow {
	return {
		id: record.id,
		sessionId,
		orderIndex,
		schemaVersion: record.schemaVersion,
		version: record.version,
		title: record.title,
		component: record.component,
		props: JSON.stringify(record.props),
		source: JSON.stringify(record.source),
		pin: JSON.stringify(record.pin),
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		lastRenderedAt: record.lastRenderedAt,
		lastAgentPatchAt: record.lastAgentPatchAt,
		lastHumanEditAt: record.lastHumanEditAt,
		dirty: JSON.stringify(record.dirty),
	}
}

export class ArtifactStore {
	private readonly db: SqliteDatabase
	private readonly jsonlPath: string

	constructor(databasePath = getDatabasePath()) {
		ensureLoomDir()
		this.db = new SqliteDatabaseCtor(databasePath)
		this.jsonlPath = getJsonlPath()
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS artifacts (
				id TEXT PRIMARY KEY,
				sessionId TEXT NOT NULL,
				orderIndex INTEGER NOT NULL,
				schemaVersion INTEGER NOT NULL,
				version INTEGER NOT NULL,
				title TEXT NOT NULL,
				component TEXT NOT NULL,
				props TEXT NOT NULL,
				source TEXT NOT NULL,
				pin TEXT NOT NULL,
				createdAt INTEGER NOT NULL,
				updatedAt INTEGER NOT NULL,
				lastRenderedAt INTEGER NOT NULL,
				lastAgentPatchAt INTEGER NOT NULL,
				lastHumanEditAt INTEGER NOT NULL,
				dirty TEXT NOT NULL
			);
			CREATE INDEX IF NOT EXISTS artifacts_session_order_idx ON artifacts(sessionId, orderIndex);
		`)
	}

	close(): void {
		this.db.close()
	}

	listArtifacts(sessionId: string): ArtifactListResult {
		const rows = this.db
			.prepare("SELECT * FROM artifacts WHERE sessionId = ? ORDER BY orderIndex ASC")
			.all(sessionId) as unknown as ArtifactRow[]
		const order: string[] = []
		const records: Record<string, GenUiArtifactRecord> = {}
		for (const row of rows) {
			const record = parseRow(row)
			order.push(record.id)
			records[record.id] = record
		}
		return { order, records }
	}

	getArtifact(sessionId: string, artifactId: string): GenUiArtifactRecord | null {
		const row = this.db
			.prepare("SELECT * FROM artifacts WHERE sessionId = ? AND id = ?")
			.get(sessionId, artifactId) as unknown as ArtifactRow | undefined
		return row ? parseRow(row) : null
	}

	upsertArtifact(sessionId: string, recordLike: Omit<GenUiArtifactRecord, "id"> & { id?: string }): GenUiArtifactRecord {
		const list = this.listArtifacts(sessionId)
		const artifactId = recordLike.id && isArtifactId(recordLike.id) ? recordLike.id : mintArtifactId()
		const existing = this.getArtifact(sessionId, artifactId)
		const orderIndex = existing ? list.order.indexOf(artifactId) : list.order.length
		const record: GenUiArtifactRecord = {
			id: artifactId,
			scope: "session",
			title: recordLike.title,
			component: recordLike.component,
			props: clone(recordLike.props),
			source: clone(recordLike.source),
			createdAt: existing?.createdAt ?? recordLike.createdAt,
			updatedAt: recordLike.updatedAt,
			lastRenderedAt: recordLike.lastRenderedAt,
			pin: clone(recordLike.pin),
			version: existing ? existing.version + 1 : (recordLike.version ?? 1),
			dirty: clone(recordLike.dirty ?? []),
			lastAgentPatchAt: recordLike.lastAgentPatchAt ?? 0,
			lastHumanEditAt: recordLike.lastHumanEditAt ?? 0,
			schemaVersion: ARTIFACT_SCHEMA_VERSION,
		}
		const row = stringifyRecord(record, sessionId, orderIndex)
		this.db
			.prepare(`
				INSERT INTO artifacts (
					id, sessionId, orderIndex, schemaVersion, version, title, component, props, source, pin,
					createdAt, updatedAt, lastRenderedAt, lastAgentPatchAt, lastHumanEditAt, dirty
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					sessionId = excluded.sessionId,
					orderIndex = excluded.orderIndex,
					schemaVersion = excluded.schemaVersion,
					version = excluded.version,
					title = excluded.title,
					component = excluded.component,
					props = excluded.props,
					source = excluded.source,
					pin = excluded.pin,
					createdAt = excluded.createdAt,
					updatedAt = excluded.updatedAt,
					lastRenderedAt = excluded.lastRenderedAt,
					lastAgentPatchAt = excluded.lastAgentPatchAt,
					lastHumanEditAt = excluded.lastHumanEditAt,
					dirty = excluded.dirty
			`)
			.run(
				row.id,
				row.sessionId,
				row.orderIndex,
				row.schemaVersion,
				row.version,
				row.title,
				row.component,
				row.props,
				row.source,
				row.pin,
				row.createdAt,
				row.updatedAt,
				row.lastRenderedAt,
				row.lastAgentPatchAt,
				row.lastHumanEditAt,
				row.dirty,
			)
		this.appendJsonl({ type: existing ? "upsert" : "create", sessionId, artifactId, at: Date.now() })
		return record
	}

	patchArtifact(input: ArtifactPatchInput): GenUiArtifactRecord | null {
		const existing = this.getArtifact(input.sessionId, input.artifactId)
		if (!existing) return null
		const next: GenUiArtifactRecord = {
			...existing,
			props: input.propsPatch ? { ...existing.props, ...clone(input.propsPatch) } : existing.props,
			pin: input.pin ? clone(input.pin) : existing.pin,
			dirty: input.markDirty ? [...input.markDirty] : existing.dirty,
			updatedAt: Date.now(),
			lastAgentPatchAt: input.lastAgentPatchAt ?? existing.lastAgentPatchAt,
			lastHumanEditAt: input.lastHumanEditAt ?? existing.lastHumanEditAt,
			lastRenderedAt: input.lastRenderedAt ?? existing.lastRenderedAt,
			version: existing.version + 1,
		}
		return this.upsertArtifact(input.sessionId, next)
	}

	private appendJsonl(entry: Record<string, unknown>): void {
		fs.appendFileSync(this.jsonlPath, `${JSON.stringify(entry)}\n`, "utf8")
	}
}

export function createArtifactStore(databasePath?: string): ArtifactStore {
	return new ArtifactStore(databasePath)
}

export function getArtifactStore(): ArtifactStore {
	if (!artifactStore) artifactStore = new ArtifactStore()
	return artifactStore
}

export function resetArtifactStoreForTests(): void {
	artifactStore?.close()
	artifactStore = null
}
