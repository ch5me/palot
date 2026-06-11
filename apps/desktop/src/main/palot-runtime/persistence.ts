import fs from "node:fs"
import path from "node:path"

import type { LoomNode } from "./wire"
import { getDataDir } from "../automation/paths"

interface LoomSessionSnapshot {
	sessionId: string
	rev: number
	tree: LoomNode | null
	updatedAt: number
}

function getLoomDataDir(): string {
	return path.join(getDataDir(), "loom")
}

function getSnapshotFilePath(sessionId: string): string {
	return path.join(getLoomDataDir(), "sessions", `${sessionId}.json`)
}

function ensureParentDir(filePath: string): void {
	fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function writeSessionSnapshot(sessionId: string, rev: number, tree: LoomNode | null): void {
	const filePath = getSnapshotFilePath(sessionId)
	ensureParentDir(filePath)
	const snapshot: LoomSessionSnapshot = {
		sessionId,
		rev,
		tree,
		updatedAt: Date.now(),
	}
	fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf8")
}

export function readSessionSnapshot(sessionId: string): LoomSessionSnapshot | null {
	const filePath = getSnapshotFilePath(sessionId)
	if (!fs.existsSync(filePath)) return null
	const raw = fs.readFileSync(filePath, "utf8")
	const parsed = JSON.parse(raw) as LoomSessionSnapshot
	if (parsed.sessionId !== sessionId) return null
	return parsed
}

export function deleteSessionSnapshot(sessionId: string): void {
	const filePath = getSnapshotFilePath(sessionId)
	if (!fs.existsSync(filePath)) return
	fs.rmSync(filePath, { force: true })
}
