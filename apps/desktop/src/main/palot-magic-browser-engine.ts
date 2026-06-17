import { execFile, execFileSync } from "node:child_process"
import fs from "node:fs"
import { createLogger } from "./logger"

const log = createLogger("palot-magic-browser-engine")

/**
 * The workspace build of the @ch5/magic-browser CLI. Used only as a dev
 * convenience fallback when MAGIC_BROWSER_BIN is unset and `magic-browser` is
 * not discoverable on PATH. Resolving to this path is LOGGED so it never
 * silently masks a missing install in a packaged build (CH5 #9).
 */
const DEV_FALLBACK_CLI = "/Users/hassoncs/src/ch5/magic-browser/dist/cli.js"

export type MagicBrowserKnowledgeMode = "local-only" | "read-global" | "read-write-global"

/**
 * Thrown when the Magic Browser CLI cannot be located. Names the exact missing
 * precondition and how to fix it rather than degrading to a silent no-op.
 */
export class MagicBrowserUnavailableError extends Error {
	override readonly name = "MagicBrowserUnavailableError"
	constructor(message: string) {
		super(message)
	}
}

/** Thrown when a Magic Browser CLI invocation fails (non-zero exit / bad JSON). */
export class MagicBrowserCliError extends Error {
	override readonly name = "MagicBrowserCliError"
	readonly args: readonly string[]
	readonly exitCode: number | null
	readonly stderr: string
	constructor(message: string, details: { args: readonly string[]; exitCode: number | null; stderr: string }) {
		super(message)
		this.args = details.args
		this.exitCode = details.exitCode
		this.stderr = details.stderr
	}
}

/** Thrown when a streamed lane's CDP endpoint cannot be resolved to a browser-level ws url. */
export class MagicBrowserCdpEndpointError extends Error {
	override readonly name = "MagicBrowserCdpEndpointError"
	readonly cdpEndpoint: string
	constructor(message: string, cdpEndpoint: string) {
		super(message)
		this.cdpEndpoint = cdpEndpoint
	}
}

export interface ResolvedMagicBrowserBin {
	/** The runtime that should execute the CLI. Either "node" (run cliPath as a script) or the bin itself on PATH. */
	command: string
	/** Args prefix to prepend before the CLI verb args (e.g. [cliPath] for node, [] for a PATH bin). */
	prefixArgs: string[]
	/** Human-readable source of resolution, for logging/diagnostics. */
	source: "env" | "path" | "dev-fallback"
}

interface ExecFileResult {
	stdout: string
	stderr: string
}

/** Injectable exec for tests. Resolves with stdout/stderr; rejects on non-zero exit. */
export type MagicBrowserExec = (command: string, args: readonly string[]) => Promise<ExecFileResult>

const defaultExec: MagicBrowserExec = (command, args) =>
	new Promise<ExecFileResult>((resolve, reject) => {
		execFile(command, args, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout, stderr) => {
			if (error) {
				const exitCode = typeof error.code === "number" ? error.code : null
				reject(
					new MagicBrowserCliError(
						`Magic Browser CLI exited with error: ${error.message}`,
						{ args, exitCode, stderr: String(stderr ?? "") },
					),
				)
				return
			}
			resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") })
		})
	})

/** Injectable PATH probe for tests. Returns the absolute path of `magic-browser`, or null. */
export type MagicBrowserPathProbe = () => string | null

const defaultPathProbe: MagicBrowserPathProbe = () => {
	try {
		const out = execFileSync("/bin/sh", ["-c", "command -v magic-browser"], { encoding: "utf-8" })
		const resolved = out.trim()
		return resolved.length > 0 ? resolved : null
	} catch {
		return null
	}
}

/** Injectable fs existence probe for tests. */
export type MagicBrowserFileProbe = (filePath: string) => boolean

const defaultFileProbe: MagicBrowserFileProbe = (filePath) => fs.existsSync(filePath)

/**
 * Resolve the Magic Browser CLI executable. Precedence:
 *   1. MAGIC_BROWSER_BIN env var (run via node <bin>)
 *   2. `magic-browser` on PATH (invoke the bin directly)
 *   3. Dev workspace build at DEV_FALLBACK_CLI (LOGGED warning) via node <cli.js>
 *   4. else throw MagicBrowserUnavailableError naming the fix
 */
export function resolveMagicBrowserBin(
	deps: {
		env?: NodeJS.ProcessEnv
		probePath?: MagicBrowserPathProbe
		probeFile?: MagicBrowserFileProbe
	} = {},
): ResolvedMagicBrowserBin {
	const env = deps.env ?? process.env
	const probePath = deps.probePath ?? defaultPathProbe
	const probeFile = deps.probeFile ?? defaultFileProbe

	const envBin = env.MAGIC_BROWSER_BIN?.trim()
	if (envBin) {
		return { command: process.execPath, prefixArgs: [envBin], source: "env" }
	}

	const onPath = probePath()
	if (onPath) {
		return { command: onPath, prefixArgs: [], source: "path" }
	}

	if (probeFile(DEV_FALLBACK_CLI)) {
		log.warn(
			"Resolved Magic Browser CLI to the dev workspace build; set MAGIC_BROWSER_BIN or install magic-browser on PATH for production.",
			{ cli: DEV_FALLBACK_CLI },
		)
		return { command: process.execPath, prefixArgs: [DEV_FALLBACK_CLI], source: "dev-fallback" }
	}

	throw new MagicBrowserUnavailableError(
		"Magic Browser CLI not found. Set MAGIC_BROWSER_BIN to the @ch5/magic-browser CLI path, " +
			"or install `magic-browser` on PATH, or build the workspace package at " +
			`${DEV_FALLBACK_CLI}.`,
	)
}

/** Run the Magic Browser CLI with the given verb args; parse JSON from stdout. */
export async function runMagicBrowserCli<T = unknown>(
	args: readonly string[],
	deps: {
		exec?: MagicBrowserExec
		resolveBin?: () => ResolvedMagicBrowserBin
	} = {},
): Promise<T> {
	const exec = deps.exec ?? defaultExec
	const bin = (deps.resolveBin ?? (() => resolveMagicBrowserBin()))()
	const fullArgs = [...bin.prefixArgs, ...args]
	const { stdout } = await exec(bin.command, fullArgs)
	const trimmed = stdout.trim()
	if (!trimmed) {
		throw new MagicBrowserCliError("Magic Browser CLI produced no stdout to parse as JSON.", {
			args: fullArgs,
			exitCode: 0,
			stderr: "",
		})
	}
	try {
		return JSON.parse(trimmed) as T
	} catch (error) {
		throw new MagicBrowserCliError(
			`Magic Browser CLI returned non-JSON stdout: ${error instanceof Error ? error.message : String(error)}`,
			{ args: fullArgs, exitCode: 0, stderr: trimmed.slice(0, 500) },
		)
	}
}

interface CdpVersionResponse {
	webSocketDebuggerUrl?: string
}

/** Injectable fetch for tests. */
export type MagicBrowserFetch = (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

const defaultFetch: MagicBrowserFetch = (url) => fetch(url)

/**
 * The lane exposes an HTTP CDP endpoint (e.g. http://127.0.0.1:9222). Magic
 * Browser needs the browser-level CDP WEBSOCKET url. Fetch <endpoint>/json/version
 * and return its webSocketDebuggerUrl. Fail fast if unreachable or missing.
 */
export async function fetchLaneWebSocketDebuggerUrl(
	cdpEndpoint: string,
	deps: { fetchImpl?: MagicBrowserFetch } = {},
): Promise<string> {
	const fetchImpl = deps.fetchImpl ?? defaultFetch
	const base = cdpEndpoint.replace(/\/+$/, "")
	const versionUrl = `${base}/json/version`
	let response: Awaited<ReturnType<MagicBrowserFetch>>
	try {
		response = await fetchImpl(versionUrl)
	} catch (error) {
		throw new MagicBrowserCdpEndpointError(
			`Failed to reach CDP endpoint ${versionUrl}: ${error instanceof Error ? error.message : String(error)}`,
			cdpEndpoint,
		)
	}
	if (!response.ok) {
		throw new MagicBrowserCdpEndpointError(
			`CDP endpoint ${versionUrl} returned HTTP ${response.status}.`,
			cdpEndpoint,
		)
	}
	const body = (await response.json()) as CdpVersionResponse
	const wsUrl = body.webSocketDebuggerUrl
	if (!wsUrl || typeof wsUrl !== "string") {
		throw new MagicBrowserCdpEndpointError(
			`CDP endpoint ${versionUrl} returned no webSocketDebuggerUrl.`,
			cdpEndpoint,
		)
	}
	return wsUrl
}

const SESSION_WORKFLOW_ID = "palot-browser"
const DEFAULT_KNOWLEDGE_MODE: MagicBrowserKnowledgeMode = "local-only"

interface MagicBrowserSessionRecord {
	id?: string
}

export interface StartRemoteCdpSessionInput {
	laneId: string
	cdpEndpoint: string
	liveUrl?: string | null
	knowledgeMode?: MagicBrowserKnowledgeMode
}

export interface StartRemoteCdpSessionResult {
	magicBrowserSessionId: string
	webSocketDebuggerUrl: string
}

export interface MagicBrowserEngineDeps {
	exec?: MagicBrowserExec
	fetchImpl?: MagicBrowserFetch
	resolveBin?: () => ResolvedMagicBrowserBin
}

/**
 * Start a Magic Browser session bound to a streamed lane's CDP endpoint over
 * remote-cdp, persisting the REAL generated UUID. Resolves the browser-level ws
 * url from the lane's HTTP CDP endpoint first (CDP url is immutable per session).
 */
export async function startRemoteCdpSession(
	input: StartRemoteCdpSessionInput,
	deps: MagicBrowserEngineDeps = {},
): Promise<StartRemoteCdpSessionResult> {
	const knowledgeMode = input.knowledgeMode ?? DEFAULT_KNOWLEDGE_MODE
	const webSocketDebuggerUrl = await fetchLaneWebSocketDebuggerUrl(input.cdpEndpoint, {
		fetchImpl: deps.fetchImpl,
	})
	const args = [
		"session",
		"start",
		SESSION_WORKFLOW_ID,
		"--adapter",
		"remote-cdp",
		"--remote-cdp-url",
		webSocketDebuggerUrl,
		"--remote-session-id",
		input.laneId,
	]
	if (input.liveUrl) {
		args.push("--remote-live-url", input.liveUrl)
	}
	args.push("--knowledge-mode", knowledgeMode)
	const record = await runMagicBrowserCli<MagicBrowserSessionRecord>(args, {
		exec: deps.exec,
		resolveBin: deps.resolveBin,
	})
	const magicBrowserSessionId = record.id
	if (!magicBrowserSessionId || typeof magicBrowserSessionId !== "string") {
		throw new MagicBrowserCliError("Magic Browser `session start` returned no session id.", {
			args,
			exitCode: 0,
			stderr: JSON.stringify(record).slice(0, 500),
		})
	}
	return { magicBrowserSessionId, webSocketDebuggerUrl }
}

/** Detach the local view of a Magic Browser session. Never kills the underlying lane. */
export async function stopSession(
	magicBrowserSessionId: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "stop", magicBrowserSessionId], {
		exec: deps.exec,
		resolveBin: deps.resolveBin,
	})
}

// --- Thin typed verb wrappers (each returns parsed JSON) -----------------------

export async function openSnapshot(
	magicBrowserSessionId: string,
	url: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "open-snapshot", magicBrowserSessionId, url], deps)
}

export async function snapshot(
	magicBrowserSessionId: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "snapshot", magicBrowserSessionId], deps)
}

export async function clickText(
	magicBrowserSessionId: string,
	text: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "click-text", magicBrowserSessionId, text], deps)
}

export async function clickSelector(
	magicBrowserSessionId: string,
	selector: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "click-selector", magicBrowserSessionId, selector], deps)
}

export async function fillSelector(
	magicBrowserSessionId: string,
	selector: string,
	value: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "fill-selector", magicBrowserSessionId, selector, value], deps)
}

export async function typeSelector(
	magicBrowserSessionId: string,
	selector: string,
	value: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "type-selector", magicBrowserSessionId, selector, value], deps)
}

export async function webSearch(
	magicBrowserSessionId: string,
	query: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "web-search", magicBrowserSessionId, query], deps)
}

export async function extractLinks(
	magicBrowserSessionId: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "extract-links", magicBrowserSessionId], deps)
}

export async function extractTables(
	magicBrowserSessionId: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "extract-tables", magicBrowserSessionId], deps)
}

export async function documentText(
	magicBrowserSessionId: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "document-text", magicBrowserSessionId], deps)
}

export async function evidence(
	magicBrowserSessionId: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "evidence", magicBrowserSessionId], deps)
}

export async function tabs(
	magicBrowserSessionId: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "tabs", magicBrowserSessionId], deps)
}

/** Run an arbitrary JS expression in the session (e.g. window.scrollBy for scrolling). */
export async function evalExpr(
	magicBrowserSessionId: string,
	expression: string,
	deps: MagicBrowserEngineDeps = {},
): Promise<unknown> {
	return runMagicBrowserCli(["session", "eval", magicBrowserSessionId, expression], deps)
}
