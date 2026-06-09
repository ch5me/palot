import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, expect, test } from "bun:test"

import { GENUI_LOCALSTORAGE_KEY, migrateLocalStorageArtifacts } from "../migrate-localstorage"
import { createArtifactStore, resetArtifactStoreForTests } from "../artifact-store"

class MemoryStorage {
	private readonly data = new Map<string, string>()

	getItem(key: string): string | null {
		return this.data.get(key) ?? null
	}

	setItem(key: string, value: string): void {
		this.data.set(key, value)
	}

	removeItem(key: string): void {
		this.data.delete(key)
	}
}

let tempDir: string | null = null

afterEach(() => {
	resetArtifactStoreForTests()
	if (tempDir) {
		fs.rmSync(tempDir, { recursive: true, force: true })
		tempDir = null
	}
})

test("migrates localStorage records into sqlite store and clears key", () => {
	tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "loom-migrate-"))
	process.env.XDG_DATA_HOME = tempDir
	const storage = new MemoryStorage()
	const fixture = {
		ses_demo: {
			order: ["art_01ARZ3NDEKTSV4RRFFQ69G5FAV"],
			records: {
				art_01ARZ3NDEKTSV4RRFFQ69G5FAV: {
					id: "art_01ARZ3NDEKTSV4RRFFQ69G5FAV",
					scope: "session",
					title: "Fixture",
					component: "dag-sparkline",
					props: { nodes: [{ id: "a", label: "A" }], edges: [] },
					source: {
						sessionId: "ses_demo",
						messageId: "msg_1",
						component: "dag-sparkline",
						rawFence: "```genui\n{}\n```",
					},
					createdAt: 1,
					updatedAt: 2,
					lastRenderedAt: 3,
					pin: { pinned: true, placement: "side-panel", pinnedAt: 4 },
				},
			},
		},
	}
	storage.setItem(GENUI_LOCALSTORAGE_KEY, JSON.stringify(fixture))
	const result = migrateLocalStorageArtifacts(storage)
	expect(result).toEqual({ migrated: 1, sessions: 1 })
	expect(storage.getItem(GENUI_LOCALSTORAGE_KEY)).toBeNull()
	const store = createArtifactStore(path.join(tempDir, "elf", "loom", "artifacts.sqlite"))
	const listed = store.listArtifacts("ses_demo")
	expect(listed.order).toEqual(["art_01ARZ3NDEKTSV4RRFFQ69G5FAV"])
	expect(listed.records["art_01ARZ3NDEKTSV4RRFFQ69G5FAV"]?.pin.pinned).toBe(true)
	store.close()
})
