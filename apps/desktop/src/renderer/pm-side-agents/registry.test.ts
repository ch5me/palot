import { describe, expect, test } from "bun:test"
import {
	SIDE_AGENT_REGISTRY,
	getLiveFedSideAgents,
	getSideAgentDocsPath,
	getSideAgentEntry,
	getSideAgentsByProvenance,
} from "./registry"
import type { SideAgentCharterStatus, SideAgentProvenance } from "./registry"

const VALID_PROVENANCE: readonly SideAgentProvenance[] = [
	"live-fed",
	"detected",
	"static",
]
const VALID_CHARTER: readonly SideAgentCharterStatus[] = [
	"durable-charter",
	"spawn-brief-only",
	"unknown",
]

describe("pm side-agent registry", () => {
	test("every entry declares provenance and charter", () => {
		for (const entry of SIDE_AGENT_REGISTRY) {
			expect(VALID_PROVENANCE).toContain(entry.provenance)
			expect(VALID_CHARTER).toContain(entry.charterStatus)
			expect(entry.id.length).toBeGreaterThan(0)
			expect(entry.label.length).toBeGreaterThan(0)
		}
	})

	test("static and detected entries never have canHaveLiveFeed", () => {
		for (const entry of SIDE_AGENT_REGISTRY) {
			if (entry.provenance === "static" || entry.provenance === "detected") {
				expect(entry.canHaveLiveFeed).toBe(false)
			}
		}
	})

	test("only live-fed entries can have live feed", () => {
		for (const entry of SIDE_AGENT_REGISTRY) {
			if (entry.canHaveLiveFeed) {
				expect(entry.provenance).toBe("live-fed")
			}
		}
	})

	test("getSideAgentEntry returns correct entry", () => {
		const entry = getSideAgentEntry("distributed-babysitter")
		expect(entry).toBeDefined()
		expect(entry?.provenance).toBe("live-fed")
		expect(entry?.canHaveLiveFeed).toBe(true)
	})

	test("getSideAgentEntry returns undefined for unknown id", () => {
		expect(getSideAgentEntry("nonexistent-agent")).toBeUndefined()
	})

	test("getSideAgentsByProvenance filters correctly", () => {
		const staticEntries = getSideAgentsByProvenance("static")
		expect(staticEntries.length).toBeGreaterThan(0)
		for (const entry of staticEntries) {
			expect(entry.provenance).toBe("static")
		}
	})

	test("getLiveFedSideAgents returns only live-fed entries", () => {
		const liveFed = getLiveFedSideAgents()
		expect(liveFed.length).toBeGreaterThan(0)
		for (const entry of liveFed) {
			expect(entry.provenance).toBe("live-fed")
			expect(entry.canHaveLiveFeed).toBe(true)
		}
	})

	test("registry has no duplicate ids", () => {
		const ids = SIDE_AGENT_REGISTRY.map((e) => e.id)
		expect(new Set(ids).size).toBe(ids.length)
	})

	test("builds docs path only when authority exists", () => {
		expect(getSideAgentDocsPath("ch5pm-daemon.md")).toBe("ch5-company/docs/ch5pm/ch5pm-daemon.md")
		expect(getSideAgentDocsPath(null)).toBeNull()
	})

	test("every entry declares non-empty responsibilities", () => {
		for (const entry of SIDE_AGENT_REGISTRY) {
			expect(entry.responsibilities.length).toBeGreaterThan(0)
		}
	})

	test("detected entries have docs links for durable-charter agents", () => {
		const detected = getSideAgentsByProvenance("detected")
		for (const entry of detected) {
			if (entry.charterStatus === "durable-charter") {
				expect(entry.docsLink).not.toBeNull()
			}
		}
	})

	test("live-fed entries always have docs links", () => {
		const liveFed = getLiveFedSideAgents()
		for (const entry of liveFed) {
			expect(entry.docsLink).not.toBeNull()
		}
	})

	test("docs path handles nested path links", () => {
		expect(getSideAgentDocsPath("ch5pm-babysitter-charter.md")).toBe(
			"ch5-company/docs/ch5pm/ch5pm-babysitter-charter.md",
		)
		expect(getSideAgentDocsPath("ch5pm-distributed-babysitter.md")).toBe(
			"ch5-company/docs/ch5pm/ch5pm-distributed-babysitter.md",
		)
	})
})
