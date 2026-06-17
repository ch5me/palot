/**
 * Handler for the show.doc tool (plugin.firefly.built-in.surface.artifacts.show-doc).
 *
 * Builds a GenUiArtifactRecord from the agent-supplied title + markdown body,
 * persists it via the main-process artifact store, then broadcasts the new
 * record to all renderer windows.
 *
 * Opening the artifacts side-panel tab is NOT this handler's concern: the tool
 * declares `uiHints: { openPanel: "artifacts" }` in its manifest and the host
 * applies that generically post-dispatch (see `broadcastToolUiHints`). The data
 * push (broadcastArtifactPushed) is a separate concern and stays here.
 */

import type { GenUiArtifactRecord } from "../../renderer/lib/types"
import { mintArtifactId } from "../../shared/loom/artifact-id"

export interface ShowDocArgs {
	title: string
	markdown: string
	format?: "markdown" | "html"
}

export interface ShowDocResult {
	artifactId: string
	opened: boolean
}

export interface ShowDocDeps {
	upsertArtifact: (sessionId: string, record: Omit<GenUiArtifactRecord, "id"> & { id?: string }) => GenUiArtifactRecord
	broadcastArtifactPushed: (sessionId: string, record: GenUiArtifactRecord) => Promise<void>
}

/**
 * Build a GenUiArtifactRecord for a plain document shown via show.doc.
 *
 * Component name convention: "doc-markdown" or "doc-html" so future renderers
 * can detect the body format. Props carry `title`, `body`, and `format`.
 */
export function buildShowDocRecord(args: ShowDocArgs, sessionId: string): Omit<GenUiArtifactRecord, "id"> & { id: string } {
	const now = Date.now()
	const format = args.format ?? "markdown"
	return {
		id: mintArtifactId(),
		scope: "session",
		title: args.title,
		component: `doc-${format}`,
		props: {
			title: args.title,
			body: args.markdown,
			format,
		},
		source: {
			sessionId,
			messageId: "show-doc-tool",
			component: `doc-${format}`,
			rawFence: "",
		},
		createdAt: now,
		updatedAt: now,
		lastRenderedAt: now,
		pin: {
			pinned: false,
			placement: null,
			pinnedAt: null,
		},
		version: 1,
		dirty: [],
		lastAgentPatchAt: now,
		lastHumanEditAt: 0,
		schemaVersion: 1,
	}
}

/**
 * Execute the show.doc tool call:
 *   1. Build the artifact record.
 *   2. Persist via artifact store.
 *   3. Broadcast "palot:artifact-pushed" to renderer windows.
 *   4. Return { artifactId, opened: true }.
 *
 * Opening the artifacts panel is handled generically by the host from the
 * tool's manifest `uiHints`, not here.
 *
 * Fails fast with a typed error when sessionId is absent.
 */
export async function executeShowDoc(
	args: ShowDocArgs,
	sessionId: string | null,
	deps: ShowDocDeps,
): Promise<{ data: ShowDocResult } | { error: { code: string; message: string } }> {
	if (!sessionId) {
		return {
			error: {
				code: "missing_session_id",
				message: "show.doc requires a session id — tool was invoked without one",
			},
		}
	}

	const partial = buildShowDocRecord(args, sessionId)
	const persisted = deps.upsertArtifact(sessionId, partial)

	await deps.broadcastArtifactPushed(sessionId, persisted)

	return {
		data: {
			artifactId: persisted.id,
			opened: true,
		},
	}
}
