/**
 * Bridges the OpenCode session lifecycle into the cmux tab/surface title.
 *
 * cmux-split-opencode.sh sets a placeholder tab title at dispatch time.
 * Once OpenCode creates a real session, Session.title from the server is
 * the authoritative value, so this plugin renames the surface to match
 * on session.created and session.updated.
 *
 * Auto-loaded by OpenCode from `~/.config/opencode/plugins/`.
 */

import { spawnSync } from "node:child_process";

const INSTALLED_KEY = Symbol.for("cmux.title.sync.installed");
const MAX_TITLE_CHARS = 80;
const CMUX_RENAME_TIMEOUT_MS = 3000;

function firstString(...values) {
	for (const value of values) {
		if (typeof value === "string" && value.trim().length > 0) return value.trim();
	}
	return null;
}

function sanitizeTitle(raw) {
	if (typeof raw !== "string") return null;
	const collapsed = raw.replace(/\s+/g, " ").trim();
	if (!collapsed) return null;
	if (collapsed.length <= MAX_TITLE_CHARS) return collapsed;
	return `${collapsed.slice(0, MAX_TITLE_CHARS - 1)}\u2026`;
}

function resolveSurface() {
	const workspaceId = firstString(process.env.CMUX_WORKSPACE_ID);
	const surfaceId = firstString(process.env.CMUX_SURFACE_ID);
	if (!workspaceId || !surfaceId) return null;
	return { workspaceId, surfaceId };
}

function renameTab(surface, title) {
	if (!surface || !title) return false;
	const bin = firstString(process.env.CMUX_OPENCODE_CMUX_BIN) || "cmux";
	try {
		const result = spawnSync(
			bin,
			[
				"rename-tab",
				"--workspace",
				surface.workspaceId,
				"--surface",
				surface.surfaceId,
				"--",
				title,
			],
			{ encoding: "utf8", stdio: ["ignore", "ignore", "pipe"], timeout: CMUX_RENAME_TIMEOUT_MS },
		);
		return result.status === 0;
	} catch (_) {
		return false;
	}
}

const CMUXTitleSync = async () => {
	if (globalThis[INSTALLED_KEY]) return {};
	globalThis[INSTALLED_KEY] = true;

	if (!resolveSurface()) return {};

	let activeSessionId = null;
	let lastAppliedTitle = null;

	return {
		event: async ({ event }) => {
			if (!event) return;
			if (event.type !== "session.created" && event.type !== "session.updated") return;

			const props = (event && typeof event === "object" && event.properties) || {};
			const info = props.info;
			if (!info || typeof info !== "object") return;

			const sessionId = firstString(info.id, props.sessionID);
			if (!sessionId) return;

			if (activeSessionId && sessionId !== activeSessionId) return;
			activeSessionId = sessionId;

			const title = sanitizeTitle(info.title);
			if (!title || title === lastAppliedTitle) return;

			const surface = resolveSurface();
			if (!surface) return;

			if (renameTab(surface, title)) {
				lastAppliedTitle = title;
			}
		},
	};
};

export { CMUXTitleSync };
export default CMUXTitleSync;
