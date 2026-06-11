import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, test } from "bun:test"

import { createArtifactStore, resetArtifactStoreForTests } from "../artifact-store"
import type { GenUiArtifactRecord } from "../../../renderer/lib/types"

let tempDir: string | null = null

function buildRecord(overrides: Partial<GenUiArtifactRecord> = {}): Omit<GenUiArtifactRecord, "id"> {
	const now = Date.now()
	return {
		scope: "session",
		title: "Demo",
		component: "dag-sparkline",
		props: { nodes: [{ id: "a", label: "A" }], edges: [] },
		source: {
			sessionId: "ses_artifact",
			messageId: "msg_1",
			component: "dag-sparkline",
			rawFence: "```genui\n{}\n```",
		},
		createdAt: now,
		updatedAt: now,
		lastRenderedAt: now,
		pin: { pinned: false, placement: null, pinnedAt: null },
		version: 1,
		dirty: [],
		lastAgentPatchAt: 0,
		lastHumanEditAt: 0,
		schemaVersion: 1,
		...overrides,
	}
}

afterEach(() => {
	resetArtifactStoreForTests()
	if (tempDir) {
		fs.rmSync(tempDir, { recursive: true, force: true })
		tempDir = null
	}
})

describe("artifact store", () => {
	test("round-trips create read update pin across restarts", () => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "loom-artifacts-"))
		process.env.XDG_DATA_HOME = tempDir
		const databasePath = path.join(tempDir, "elf", "loom", "artifacts.sqlite")
		const store = createArtifactStore(databasePath)
		const created = store.upsertArtifact("ses_artifact", buildRecord())
		expect(created.id.startsWith("art_")).toBe(true)
		expect(store.listArtifacts("ses_artifact").order).toEqual([created.id])
		store.close()

		const reopened = createArtifactStore(databasePath)
		const patched = reopened.patchArtifact({
			sessionId: "ses_artifact",
			artifactId: created.id,
			propsPatch: { animate: "flow" },
			pin: { pinned: true, placement: "side-panel", pinnedAt: Date.now() },
			markDirty: ["props.animate"],
			lastAgentPatchAt: Date.now(),
		})
		expect(patched?.pin.pinned).toBe(true)
		expect(patched?.props.animate).toBe("flow")
		expect(patched?.dirty).toEqual(["props.animate"])
		reopened.close()

		const third = createArtifactStore(databasePath)
		const listed = third.listArtifacts("ses_artifact")
		expect(listed.records[created.id]?.pin.pinned).toBe(true)
		expect(listed.records[created.id]?.props.animate).toBe("flow")
		third.close()
	})
})
