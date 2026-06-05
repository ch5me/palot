/**
 * Bridges the OpenCode session lifecycle into the cmux tab/surface title.
 *
 * Mirrors the existing cmux-session.js hook pattern: on session.created /
 * session.updated, sends a session-start hook to cmux with the title in the
 * payload. As an immediate fallback that works without a cmux-side change,
 * the plugin also reads ~/.cmuxterm/opencode-hook-sessions.json (populated
 * by cmux when the hook is recorded) to resolve session_id -> surface_id and
 * then calls `cmux rename-tab` directly.
 *
 * Auto-loaded by OpenCode from ~/.config/opencode/plugins/.
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const INSTALLED_KEY = Symbol.for("cmux.title.sync.installed");
const HOOK_TIMEOUT_MS = 5000;
const LOOKUP_TIMEOUT_MS = 1500;
const LOOKUP_POLL_MS = 50;
const HOOK_SESSIONS_FILE = path.join(
	os.homedir(),
	".cmuxterm",
	"opencode-hook-sessions.json",
);
const MAX_TITLE_CHARS = 80;

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

function hookEnv(cwd) {
	const env = { ...process.env };
	delete env.AMP_API_KEY;
	if (!env.CMUX_AGENT_LAUNCH_CWD) {
		env.CMUX_AGENT_LAUNCH_CWD = cwd || process.cwd();
	}
	return env;
}

function sendTitleHook({ sessionId, title, cwd }) {
	if (process.env.CMUX_OPENCODE_HOOKS_DISABLED === "1") return;
	const bin = firstString(process.env.CMUX_OPENCODE_CMUX_BIN) || "cmux";
	try {
		spawnSync(
			bin,
			["hooks", "opencode", "session-start"],
			{
				input: JSON.stringify({
					session_id: sessionId,
					title,
					cwd,
					event: "session.title",
					hook_event_name: "SessionTitle",
				}),
				encoding: "utf8",
				env: hookEnv(cwd),
				stdio: ["pipe", "ignore", "ignore"],
				timeout: HOOK_TIMEOUT_MS,
			},
		);
	} catch (_) {}
}

function sleepSync(ms) {
	const end = Date.now() + ms;
	while (Date.now() < end) {}
}

function lookupSurfaceForSession(sessionId) {
	const deadline = Date.now() + LOOKUP_TIMEOUT_MS;
	while (Date.now() < deadline) {
		try {
			const raw = fs.readFileSync(HOOK_SESSIONS_FILE, "utf8");
			const data = JSON.parse(raw);
			const sessions = data && typeof data === "object" ? data.sessions : null;
			if (sessions && typeof sessions === "object") {
				const entry = sessions[sessionId];
				if (entry && typeof entry === "object" && entry.surfaceId) {
					return entry.surfaceId;
				}
			}
		} catch (_) {}
		sleepSync(LOOKUP_POLL_MS);
	}
	return null;
}

function renameTab(surface, title) {
	if (!surface || !title) return false;
	const bin = firstString(process.env.CMUX_OPENCODE_CMUX_BIN) || "cmux";
	try {
		const result = spawnSync(
			bin,
			["rename-tab", "--surface", surface, "--", title],
			{ encoding: "utf8", stdio: ["ignore", "ignore", "pipe"], timeout: HOOK_TIMEOUT_MS },
		);
		return result.status === 0;
	} catch (_) {
		return false;
	}
}

const CMUXTitleSync = async () => {
	if (globalThis[INSTALLED_KEY]) return {};
	globalThis[INSTALLED_KEY] = true;

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

			const cwd = firstString(info.directory, props.cwd, process.cwd());

			sendTitleHook({ sessionId, title, cwd });

			const surface = lookupSurfaceForSession(sessionId);
			if (surface && renameTab(surface, title)) {
				lastAppliedTitle = title;
			}
		},
	};
};

export { CMUXTitleSync };
export default CMUXTitleSync;
