import { Hono } from "hono"

/**
 * CH5PM daemon proxy routes.
 *
 * The CH5PM daemon (ch5-company `packages/ch5pm-daemon`) runs a combined
 * read+write HTTP server on a deterministic local port (43130 by config).
 * The renderer never talks to the daemon directly — this proxy is the
 * single seam between the Firefly client and the PM control plane.
 *
 * - GET  /state             → daemon GET  /pm/state (includes attentionQueue)
 * - POST /attention/resolve → daemon POST /mutations/attention/resolve
 * - POST /attention/cancel  → daemon POST /mutations/attention/cancel
 *
 * No fallback: if the daemon is unreachable we fail loud with a 502 naming
 * the daemon URL. A stale `pm-state.json` fallback would silently hide open
 * p0 decisions, which is worse than a visible outage.
 */

const DEFAULT_DAEMON_BASE_URL = "http://127.0.0.1:43130"
const DAEMON_TIMEOUT_MS = 15_000

function daemonBaseUrl(): string {
	const override = process.env.CH5PM_DAEMON_URL?.trim()
	if (override && override.length > 0) {
		return override.replace(/\/+$/, "")
	}
	return DEFAULT_DAEMON_BASE_URL
}

/** Forward a daemon response body + status verbatim as JSON. */
async function passthrough(upstream: Response): Promise<Response> {
	const body = await upstream.text()
	return new Response(body, {
		status: upstream.status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
		},
	})
}

async function proxyDaemon(path: string, init?: RequestInit): Promise<Response> {
	const url = `${daemonBaseUrl()}${path}`
	let upstream: Response
	try {
		upstream = await fetch(url, {
			...init,
			signal: AbortSignal.timeout(DAEMON_TIMEOUT_MS),
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		return Response.json(
			{ ok: false, error: `CH5PM daemon unreachable at ${url}: ${message}` },
			{ status: 502 },
		)
	}
	return passthrough(upstream)
}

function proxyDaemonMutation(path: string, body: string): Promise<Response> {
	return proxyDaemon(path, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body,
	})
}

const app = new Hono()

const routes = app
	.get("/state", () => proxyDaemon("/pm/state"))
	.post("/attention/resolve", async (c) =>
		proxyDaemonMutation("/mutations/attention/resolve", await c.req.text()),
	)
	.post("/attention/cancel", async (c) =>
		proxyDaemonMutation("/mutations/attention/cancel", await c.req.text()),
	)

export default routes
