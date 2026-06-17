import { describe, expect, it, mock } from "bun:test"
import type { GenUiArtifactRecord } from "../../renderer/lib/types"
import { buildShowDocRecord, executeShowDoc } from "./artifacts-show-doc"
import type { ShowDocDeps } from "./artifacts-show-doc"

function makeDeps(overrides?: Partial<ShowDocDeps>): ShowDocDeps {
	const upsertArtifact = mock((_sessionId: string, record: Omit<GenUiArtifactRecord, "id"> & { id?: string }) => ({
		...record,
		id: (record as { id?: string }).id ?? "art_test",
	} as GenUiArtifactRecord))
	const broadcastArtifactPushed = mock(async (_sessionId: string, _record: GenUiArtifactRecord) => {})
	return {
		upsertArtifact,
		broadcastArtifactPushed,
		...overrides,
	}
}

describe("buildShowDocRecord", () => {
	it("sets component to doc-markdown by default", () => {
		const record = buildShowDocRecord({ title: "My Report", markdown: "# Hello" }, "ses_abc")
		expect(record.component).toBe("doc-markdown")
		expect(record.props.body).toBe("# Hello")
		expect(record.props.title).toBe("My Report")
		expect(record.props.format).toBe("markdown")
		expect(record.title).toBe("My Report")
		expect(record.scope).toBe("session")
		expect(record.schemaVersion).toBe(1)
	})

	it("respects explicit html format", () => {
		const record = buildShowDocRecord({ title: "Doc", markdown: "<p>hi</p>", format: "html" }, "ses_abc")
		expect(record.component).toBe("doc-html")
		expect(record.props.format).toBe("html")
	})

	it("source.sessionId matches argument", () => {
		const record = buildShowDocRecord({ title: "T", markdown: "M" }, "ses_xyz")
		expect(record.source.sessionId).toBe("ses_xyz")
	})
})

describe("executeShowDoc", () => {
	it("returns typed error when sessionId is null", async () => {
		const deps = makeDeps()
		const result = await executeShowDoc({ title: "T", markdown: "M" }, null, deps)
		expect("error" in result).toBe(true)
		if ("error" in result) {
			expect(result.error.code).toBe("missing_session_id")
		}
		expect((deps.upsertArtifact as ReturnType<typeof mock>).mock.calls.length).toBe(0)
		expect((deps.broadcastArtifactPushed as ReturnType<typeof mock>).mock.calls.length).toBe(0)
	})

	it("persists the record and broadcasts the data push on success (no panel open here)", async () => {
		const deps = makeDeps()
		const result = await executeShowDoc({ title: "My Doc", markdown: "# Content" }, "ses_123", deps)

		expect("data" in result).toBe(true)
		if ("data" in result) {
			expect(typeof result.data.artifactId).toBe("string")
			expect(result.data.opened).toBe(true)
		}

		const upsertCalls = (deps.upsertArtifact as ReturnType<typeof mock>).mock.calls
		expect(upsertCalls.length).toBe(1)
		expect(upsertCalls[0][0]).toBe("ses_123")

		const pushCalls = (deps.broadcastArtifactPushed as ReturnType<typeof mock>).mock.calls
		expect(pushCalls.length).toBe(1)
		expect(pushCalls[0][0]).toBe("ses_123")

		// Opening the artifacts panel is no longer this handler's job — the host
		// applies it generically from the tool's manifest uiHints. The handler has
		// no broadcastOpenSidePanel dep at all now.
		expect("broadcastOpenSidePanel" in deps).toBe(false)
	})

	it("returns the artifactId from the persisted record", async () => {
		const fixedId = "art_0001XYZ"
		const deps = makeDeps({
			upsertArtifact: (_sessionId, record) => ({
				...(record as GenUiArtifactRecord),
				id: fixedId,
			}),
		})
		const result = await executeShowDoc({ title: "T", markdown: "M" }, "ses_abc", deps)
		if ("data" in result) {
			expect(result.data.artifactId).toBe(fixedId)
		}
	})
})
