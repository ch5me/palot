import { Hono } from "hono"
import { cors } from "hono/cors"
import browserLanes, {
	LOCAL_LANE_AUTH_HEADER,
	resolveBrowserLaneProxyTarget,
} from "./routes/browser-lanes"
import ch5pm from "./routes/ch5pm"
import devmux from "./routes/devmux"
import files from "./routes/files"
import health from "./routes/health"
import mcpConnections from "./routes/mcp-connections"
import modelState from "./routes/model-state"
import servers from "./routes/servers"
import { ensureSingleServer } from "./services/server-manager"

// ============================================================
// App — CORS middleware applied first, then routes chained for RPC
// ============================================================

const app = new Hono()

// Middleware — applied via .use() before route chaining
app.use(
	"*",
	cors({
		origin: ["http://localhost:20883", "http://127.0.0.1:20883"],
	}),
)

// Routes — chained for Hono RPC type inference
const routes = app
	.route("/api/servers", servers)
	.route("/api/model-state", modelState)
	.route("/api/mcp-connections", mcpConnections)
	.route("/api/files", files)
	.route("/api/devmux", devmux)
	.route("/api/ch5pm", ch5pm)
	.route("/browser", browserLanes)
	.route("/health", health)

export type AppType = typeof routes

type BrowserProxyMessage = string | ArrayBuffer | Uint8Array

interface BrowserProxyWebSocketData {
	closed: boolean
	queue: BrowserProxyMessage[]
	upstream: WebSocket
	upstreamReady: boolean
}

const BrowserWebSocket = WebSocket as unknown as {
	new (url: string, options: Bun.WebSocketOptions): WebSocket
}

// ============================================================
// Start
// ============================================================

const port = Number(process.env.PORT) || 30206

console.log(`Elf server starting on port ${port}`)

// Eagerly start the single OpenCode server in the background
ensureSingleServer()
	.then((server) => {
		console.log(`OpenCode server ready at ${server.url}`)
	})
	.catch((err) => {
		console.error("Failed to start OpenCode server on boot:", err)
		process.exitCode = 1
	})

export default {
	port,
	async fetch(request: Request, server: Bun.Server<BrowserProxyWebSocketData>) {
		if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
			const upstreamUrl = await resolveBrowserLaneProxyTarget(request.url, "ws:")
			if (upstreamUrl) {
				const upstream = new BrowserWebSocket(upstreamUrl, {
					headers: { authorization: LOCAL_LANE_AUTH_HEADER },
				})
				upstream.binaryType = "arraybuffer"
				const data: BrowserProxyWebSocketData = {
					closed: false,
					queue: [],
					upstream,
					upstreamReady: false,
				}
				const upgraded = server.upgrade(request, { data })
				if (!upgraded) {
					upstream.close()
					return new Response("WebSocket upgrade failed", { status: 400 })
				}
				return
			}
		}
		return app.fetch(request)
	},
	websocket: {
		open(ws: Bun.ServerWebSocket<BrowserProxyWebSocketData>) {
			const { upstream } = ws.data
			upstream.addEventListener("open", () => {
				ws.data.upstreamReady = true
				for (const message of ws.data.queue.splice(0)) {
					upstream.send(message)
				}
			})
			upstream.addEventListener("message", (event) => {
				const data = event.data
				if (typeof data === "string") {
					ws.send(data)
					return
				}
				if (data instanceof ArrayBuffer) {
					ws.send(data)
					return
				}
				if (data instanceof Blob) {
					void data.arrayBuffer().then((buffer) => {
						if (!ws.data.closed) ws.send(buffer)
					})
				}
			})
			upstream.addEventListener("close", (event) => {
				if (!ws.data.closed) ws.close(event.code, event.reason)
			})
			upstream.addEventListener("error", () => {
				if (!ws.data.closed) ws.close(1011, "Browser lane upstream websocket failed")
			})
		},
		message(ws: Bun.ServerWebSocket<BrowserProxyWebSocketData>, message: string | Buffer) {
			const { upstream } = ws.data
			if (ws.data.upstreamReady && upstream.readyState === WebSocket.OPEN) {
				upstream.send(message)
				return
			}
			ws.data.queue.push(message)
		},
		close(ws: Bun.ServerWebSocket<BrowserProxyWebSocketData>) {
			ws.data.closed = true
			if (
				ws.data.upstream.readyState === WebSocket.OPEN ||
				ws.data.upstream.readyState === WebSocket.CONNECTING
			) {
				ws.data.upstream.close()
			}
		},
	},
}
