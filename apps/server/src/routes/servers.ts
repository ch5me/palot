import { Hono } from "hono"
import { activeSessionPresenceService } from "../services/active-session-presence-service"
import { ensureSingleServer, getServerUrl, stopServer } from "../services/server-manager"

const ACTIVE_SESSION_STREAM_HEARTBEAT_MS = 10_000
const ACTIVE_SESSION_STREAM_RETRY_MS = 5000

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
			const snapshot = await activeSessionPresenceService.getSnapshot(server.url)
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
			let cleanupStream: (() => void) | null = null

			const stream = new ReadableStream<Uint8Array>({
				start(controller) {
					let closed = false
					let unsubscribe: (() => void) | null = null

					const close = () => {
						if (closed) return
						closed = true
						clearInterval(heartbeatTimer)
						unsubscribe?.()
						try {
							controller.close()
						} catch {}
					}
					cleanupStream = close

					const emit = (event: string, payload: unknown) => {
						if (closed) return
						try {
							controller.enqueue(encodeSseChunk(event, payload))
						} catch {
							close()
						}
					}

					const heartbeatTimer = setInterval(() => {
						emit("heartbeat", { at: Date.now() })
					}, ACTIVE_SESSION_STREAM_HEARTBEAT_MS)

					signal.addEventListener("abort", close, { once: true })

					try {
						controller.enqueue(
							new TextEncoder().encode(`retry: ${ACTIVE_SESSION_STREAM_RETRY_MS}\n\n`),
						)
					} catch {
						close()
						return
					}

					const nextUnsubscribe = activeSessionPresenceService.subscribe(server.url, {
						onError: (err) => {
							emit("presence-error", {
								message:
									err instanceof Error ? err.message : "Failed to inspect active OpenCode sessions",
								at: Date.now(),
							})
						},
						onSnapshot: (snapshot) => emit("presence", snapshot),
					})
					unsubscribe = nextUnsubscribe
					if (closed) unsubscribe()
				},
				cancel() {
					cleanupStream?.()
				},
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
