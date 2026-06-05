import { execFile } from "node:child_process"
import type { BrowserLaneHealth } from "../shared/browser-lanes"

const PROBE_TIMEOUT_MS = 2500
const COMPOSE_TIMEOUT_MS = 90_000

export type ComposeAction = "up" | "down"

export interface ComposeRunResult {
	ok: boolean
	stdout: string
	stderr: string
	code: number | null
	error?: string
}

function buildAuthHeader(user: string, password: string): string {
	const encoded = Buffer.from(`${user}:${password}`).toString("base64")
	return `Basic ${encoded}`
}

export async function runBrowserLaneCompose(
	composeCommand: string,
	composeFile: string,
	action: ComposeAction,
): Promise<ComposeRunResult> {
	const parts = composeCommand.split(" ")
	const bin = parts[0] ?? ""
	const prefix = parts.slice(1)
	const verb = action === "up" ? "up" : "down"
	const args = bin === "docker" ? [...prefix, "-f", composeFile, verb, "-d"] : [...prefix, "-f", composeFile, verb]
	return await new Promise((resolve) => {
		execFile(
			bin,
			args,
			{ timeout: COMPOSE_TIMEOUT_MS, env: process.env, maxBuffer: 1024 * 1024 },
			(error, stdout, stderr) => {
				resolve({
					ok: !error,
					stdout: stdout?.toString() ?? "",
					stderr: stderr?.toString() ?? "",
					code:
						error && typeof error === "object" && "code" in error
							? ((error as { code: number | null }).code ?? null)
							: 0,
					error: error instanceof Error ? error.message : undefined,
				})
			},
		)
	})
}

async function probeUrl(
	url: string,
	method: "HEAD" | "GET",
	auth: { user: string; password: string },
): Promise<{ ok: boolean; status: number; error: string | null }> {
	try {
		const response = await fetch(url, {
			method,
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			headers: { authorization: buildAuthHeader(auth.user, auth.password) },
		})
		return { ok: response.ok, status: response.status, error: null }
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

export interface ProbeInput {
	streamUrl: string | null
	cdpUrl: string | null
	auth: { user: string; password: string }
}

export async function probeBrowserLaneEndpoints(
	input: ProbeInput,
): Promise<{ streamReady: boolean; cdpReady: boolean; streamError: string | null; cdpError: string | null }> {
	const streamPromise: Promise<{ ok: boolean; status: number; error: string | null }> = input.streamUrl
		? probeUrl(input.streamUrl, "HEAD", input.auth)
		: Promise.resolve({ ok: false, status: 0, error: "Stream URL missing" })
	const cdpUrl = input.cdpUrl ? `${input.cdpUrl.replace(/\/$/, "")}/json/version` : null
	const cdpPromise: Promise<{ ok: boolean; status: number; error: string | null }> = cdpUrl
		? probeUrl(cdpUrl, "GET", input.auth)
		: Promise.resolve({ ok: false, status: 0, error: "CDP URL missing" })
	const [stream, cdp] = await Promise.all([streamPromise, cdpPromise])
	return {
		streamReady: stream.ok,
		cdpReady: cdp.ok,
		streamError: stream.error,
		cdpError: cdp.error,
	}
}

export interface HealthFromProbeInput {
	streamUrl: string | null
	cdpUrl: string | null
	streamReady: boolean
	cdpReady: boolean
	streamError: string | null
	cdpError: string | null
	mode: "local" | "remote"
	profilePath: string | null
	profileResetAt: number | null
}

export function buildHealthFromProbe(input: HealthFromProbeInput): BrowserLaneHealth {
	const checkedAt = Date.now()
	const { streamReady, cdpReady, mode, profilePath, profileResetAt } = input
	let status: BrowserLaneHealth["status"]
	let message: string
	if (mode === "local") {
		if (streamReady && cdpReady) {
			status = "degraded"
			message = "Stream route ready, CDP probe pending"
		} else if (streamReady) {
			status = "degraded"
			message = "Stream route ready, CDP probe pending"
		} else if (cdpReady) {
			status = "degraded"
			message = "CDP ready, stream unavailable"
		} else if (profilePath) {
			status = "profile-locked"
			message = profileResetAt
				? `Profile reset at ${new Date(profileResetAt).toISOString()}. Restart lane to create a clean session.`
				: "Profile exists but runtime has not started yet"
		} else {
			status = "stopped"
			message = "Lane stopped"
		}
	} else if (streamReady && cdpReady) {
		status = "degraded"
		message = "Remote lane attached and reachable"
	} else {
		status = "error"
		message = "Remote lane unreachable or not configured"
	}
	return {
		status,
		stream: {
			url: input.streamUrl,
			checkedAt,
			state: streamReady ? "ready" : "failed",
			error: streamReady ? null : input.streamError,
		},
		cdp: {
			url: input.cdpUrl,
			checkedAt,
			state: cdpReady ? "ready" : "failed",
			error: cdpReady ? null : input.cdpError,
		},
		message,
	}
}
