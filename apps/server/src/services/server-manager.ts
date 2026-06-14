// ============================================================
// Types
// ============================================================

export interface OpenCodeServer {
	url: string
	pid: number | null
	managed: boolean
}

// ============================================================
// State — single server
// ============================================================

let singleServer: {
	server: OpenCodeServer
	process: ReturnType<typeof Bun.spawn> | null
} | null = null

class OpenCodePortConflictError extends Error {
	constructor(port: number, stderr = "") {
		const detail = stderr.trim() ? `\n${stderr.trim()}` : ""
		super(
			`Palot embedded OpenCode failed to bind ${port}. Dedicated port ${port} avoids the shared :4096 host after the 2026-06-09 outage.${detail}`,
		)
		this.name = "OpenCodePortConflictError"
	}
}

function isPortBindConflict(stderr: string): boolean {
	return stderr.includes("EADDRINUSE") || stderr.includes("address already in use")
}

const DEFAULT_OPENCODE_PORT = 14096

// 4096 is reserved for the shared OpenCode host; palot only points at it in
// external mode (never spawns). Managed mode defaults elsewhere.
const OPENCODE_PORT = Number(process.env.OPENCODE_PORT) || DEFAULT_OPENCODE_PORT
const OPENCODE_HOSTNAME = process.env.OPENCODE_HOSTNAME || "127.0.0.1"

/**
 * OPENCODE_MODE selects who owns the OpenCode server lifecycle:
 * - "external": palot NEVER spawns OpenCode. It requires a server already
 *   running at the configured host:port (e.g. the process-compose-supervised
 *   shared host on :4096 in dev) and fails loud if it is missing.
 * - "managed": palot spawns and owns OpenCode if none is running. Packaged
 *   customer builds use this with OPENCODE_BIN pointing at the bundled
 *   portable opencode binary.
 */
type OpenCodeMode = "external" | "managed"

function resolveOpenCodeMode(): OpenCodeMode {
	const raw = process.env.OPENCODE_MODE
	if (!raw || raw === "managed") return "managed"
	if (raw === "external") return "external"
	throw new Error(`Invalid OPENCODE_MODE "${raw}" — expected "external" or "managed"`)
}

const OPENCODE_MODE = resolveOpenCodeMode()

// Managed-mode binary. Defaults to "opencode" resolved with ~/.opencode/bin
// first on PATH (the local dev copy); packaged builds set OPENCODE_BIN.
const OPENCODE_BIN = process.env.OPENCODE_BIN || "opencode"

class OpenCodeExternalServerMissingError extends Error {
	constructor(url: string) {
		super(
			`OPENCODE_MODE=external but no OpenCode server is responding at ${url}. ` +
				`Palot will not spawn one in external mode. Start the shared host ` +
				`(process-compose opencode-serve) or switch to OPENCODE_MODE=managed.`,
		)
		this.name = "OpenCodeExternalServerMissingError"
	}
}

// ============================================================
// Public API
// ============================================================

/**
 * Ensures the single OpenCode server is running.
 * Starts it if not already running. Returns the server info.
 *
 * The server is started without a specific cwd — it serves ALL projects.
 * Each API request uses the `directory` query param to scope to a project.
 */
export async function ensureSingleServer(): Promise<OpenCodeServer> {
	if (singleServer) return singleServer.server

	// Check if there's already an opencode server running on our port
	const existing = await detectExistingServer()
	if (existing) {
		singleServer = { server: existing, process: null }
		return existing
	}

	if (OPENCODE_MODE === "external") {
		throw new OpenCodeExternalServerMissingError(`http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT}`)
	}

	// Start a new one
	const proc = Bun.spawn({
		cmd: [OPENCODE_BIN, "serve", `--hostname=${OPENCODE_HOSTNAME}`, `--port=${OPENCODE_PORT}`],
		cwd: process.env.HOME, // arbitrary cwd — directory param overrides per-request
		stdout: "pipe",
		stderr: "pipe",
		env: {
			...process.env,
			PATH: `${process.env.HOME}/.opencode/bin:${process.env.PATH}`,
		},
	})

	const stderrChunks: string[] = []
	proc.stderr?.pipeTo(
		new WritableStream({
			write(chunk) {
				stderrChunks.push(Buffer.from(chunk).toString())
			},
		}),
	)

	const url = `http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT}`
	const server: OpenCodeServer = {
		url,
		pid: proc.pid,
		managed: true,
	}

	singleServer = { server, process: proc }

	// Clean up on exit
	proc.exited.then(() => {
		if (singleServer?.process === proc) {
			console.log(`OpenCode server (pid ${proc.pid}) exited — will restart on next request`)
			singleServer = null
		}
	})

	// Wait for the server to be ready. Cold start can exceed 50s before
	// /session responds (plugin + project index warmup), so wait generously.
	try {
		await waitForReady(url, 120_000)
	} catch (error) {
		const stderr = stderrChunks.join("")
		if (isPortBindConflict(stderr)) {
			proc.kill()
			singleServer = null
			throw new OpenCodePortConflictError(OPENCODE_PORT, stderr)
		}
		proc.kill()
		singleServer = null
		throw error
	}

	console.log(`OpenCode server started at ${url} (pid ${proc.pid})`)
	return server
}

/**
 * Gets the single server URL, or null if not running.
 */
export function getServerUrl(): string | null {
	return singleServer?.server.url ?? null
}

/**
 * Stops the single server if we manage it.
 */
export function stopServer(): boolean {
	if (!singleServer?.process) return false
	singleServer.process.kill()
	singleServer = null
	return true
}

// ============================================================
// Internal helpers
// ============================================================

/**
 * Detects an existing opencode server running on the expected port.
 */
async function detectExistingServer(): Promise<OpenCodeServer | null> {
	const url = `http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT}`
	try {
		// /global/health is instance-free. A directory-less /session probe makes
		// the shared host cold-bootstrap its cwd as a project (plugins, LSP, VCS
		// scans), which blocks its event loop for tens of seconds fleet-wide.
		// The shared host can still take several seconds to answer under load.
		const res = await fetch(`${url}/global/health`, {
			signal: AbortSignal.timeout(10_000),
		})
		if (res.ok) {
			return { url, pid: null, managed: false }
		}
	} catch {
		// Not running
	}
	return null
}

/**
 * Polls the instance-free health endpoint until the server responds.
 */
async function waitForReady(url: string, timeoutMs: number): Promise<void> {
	const start = Date.now()
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(`${url}/global/health`, {
				signal: AbortSignal.timeout(1000),
			})
			if (res.ok) return
		} catch {
			// Not ready yet
		}
		await Bun.sleep(250)
	}
	throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`)
}
