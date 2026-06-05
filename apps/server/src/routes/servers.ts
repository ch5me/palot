import { Hono } from "hono"
import { getActiveOpenCodeSessions } from "../services/opencode-active-sessions"
import { ensureSingleServer, getServerUrl, stopServer } from "../services/server-manager"

const ACTIVE_SESSION_STREAM_POLL_MS = 1000
const ACTIVE_SESSION_STREAM_HEARTBEAT_MS = 10_000

function buildActiveSessionSnapshotKey(
	snapshot: Awaited<ReturnType<typeof getActiveOpenCodeSessions>>,
): string {
	const sessions = [...snapshot.sessions]
		.sort((a, b) => a.sessionId.localeCompare(b.sessionId))
		.map((session) => ({
			sessionId: session.sessionId,
			directory: session.directory,
			pid: session.pid,
			source: session.source,
		}))

	return JSON.stringify({
		serverUrl: snapshot.serverUrl,
		clientCount: snapshot.clientCount,
		sessionCount: snapshot.sessionCount,
		sessions,
	})
}

function encodeSseChunk(event: string, payload: unknown): Uint8Array {
	return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`)
}

const app = new Hono()
	// New primary endpoint — ensures the single server is running and returns its URL
	.get("/opencode", async (c) => {
		try {
			const server = await ensureSingleServer()
			return c.json({ url: server.url }, 200)
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to start OpenCode server"
			return c.json({ error: message }, 500)
		}
	})
	.get("/opencode/active-sessions", async (c) => {
		try {
			const server = await ensureSingleServer()
			const snapshot = await getActiveOpenCodeSessions(server.url)
			return c.json(snapshot, 200)
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to inspect active OpenCode sessions"
			return c.json({ error: message }, 500)
		}
	})
	.get("/opencode/active-sessions/events", async (c) => {
		try {
			const server = await ensureSingleServer()
			const signal = c.req.raw.signal

			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					let closed = false
					let polling = false
					let lastSnapshotKey: string | null = null

					const close = () => {
						if (closed) return
						closed = true
						clearInterval(pollTimer)
						clearInterval(heartbeatTimer)
						try {
							controller.close()
						} catch {}
					}

					const emit = (event: string, payload: unknown) => {
						if (closed) return
						try {
							controller.enqueue(encodeSseChunk(event, payload))
						} catch {
							close()
						}
					}

					const tick = async (force = false) => {
						if (closed || polling) return
						polling = true
						try {
							const snapshot = await getActiveOpenCodeSessions(server.url)
							const nextKey = buildActiveSessionSnapshotKey(snapshot)
							if (force || nextKey !== lastSnapshotKey) {
								lastSnapshotKey = nextKey
								emit("presence", snapshot)
							}
						} catch (err) {
							emit("presence-error", {
								message:
									err instanceof Error ? err.message : "Failed to inspect active OpenCode sessions",
								at: Date.now(),
							})
						} finally {
							polling = false
						}
					}

					const pollTimer = setInterval(() => {
						void tick(false)
					}, ACTIVE_SESSION_STREAM_POLL_MS)
					const heartbeatTimer = setInterval(() => {
						emit("heartbeat", { at: Date.now() })
					}, ACTIVE_SESSION_STREAM_HEARTBEAT_MS)

					signal.addEventListener("abort", close, { once: true })

					try {
						controller.enqueue(new TextEncoder().encode("retry: 1000\n\n"))
					} catch {
						close()
						return
					}

					void tick(true)
				},
				cancel() {},
			})

			return new Response(stream, {
				headers: {
					"Content-Type": "text/event-stream",
					"Cache-Control": "no-cache, no-transform",
					Connection: "keep-alive",
					"X-Accel-Buffering": "no",
				},
			})
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to open active OpenCode session event stream"
			return c.json({ error: message }, 500)
		}
	})
	// Keep legacy endpoints for backward compat during transition
	.get("/", async (c) => {
		const url = getServerUrl()
		const servers = url
			? [{ id: "single", url, directory: "", name: "opencode", pid: null, managed: true }]
			: []
		return c.json({ servers }, 200)
	})
	.post("/start", async (c) => {
		try {
			const server = await ensureSingleServer()
			return c.json(
				{
					server: {
						id: "single",
						url: server.url,
						directory: "",
						name: "opencode",
						pid: server.pid,
						managed: server.managed,
					},
				},
				200,
			)
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to start server"
			return c.json({ error: message }, 500)
		}
	})
	.post("/stop", async (c) => {
		const stopped = stopServer()
		return c.json({ stopped }, 200)
	})

export default app
