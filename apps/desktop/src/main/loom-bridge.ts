import { createServer } from "node:http"
import { WebSocketServer } from "ws"
import { pollLoomSession } from "./palot-runtime/session-store"

export const LOOM_POLL_BATCH_MS = Number(process.env.LOOM_POLL_BATCH_MS ?? 250)

export interface LoomBridgeServerInfo {
	host: string
	port: number
	token: string
	surfaceUrl: (sessionId: string) => string
}

let loomBridgeServer: LoomBridgeServerInfo | null = null

export async function ensureLoomBridgeServer(): Promise<LoomBridgeServerInfo> {
	if (loomBridgeServer) return loomBridgeServer

	const token = crypto.randomUUID()
	const server = createServer()
	const wss = new WebSocketServer({ server })

	wss.on("connection", (socket, request) => {
		const url = new URL(request.url ?? "/", "http://127.0.0.1")
		const parts = url.pathname.split("/").filter(Boolean)
		if (parts.length !== 2 || parts[0] !== "loom") {
			socket.close(1008, "invalid-path")
			return
		}
		if (url.searchParams.get("token") !== token) {
			socket.close(1008, "invalid-token")
			return
		}
		const sessionId = parts[1]
		let lastSentRev = -1
		const initial = pollLoomSession(sessionId, lastSentRev)
		lastSentRev = initial.rev
		socket.send(JSON.stringify(initial))
		const interval = setInterval(() => {
			if (socket.readyState !== socket.OPEN) return
			const next = pollLoomSession(sessionId, lastSentRev)
			lastSentRev = next.rev
			socket.send(JSON.stringify(next))
		}, LOOM_POLL_BATCH_MS)
		socket.on("close", () => clearInterval(interval))
	})

	await new Promise<void>((resolve, reject) => {
		server.once("error", reject)
		server.listen(0, "127.0.0.1", () => {
			server.off("error", reject)
			resolve()
		})
	})

	const address = server.address()
	if (!address || typeof address === "string") {
		server.close()
		throw new Error("Loom bridge server did not bind to a TCP port")
	}
	server.unref()
	loomBridgeServer = {
		host: "127.0.0.1",
		port: address.port,
		token,
		surfaceUrl: (sessionId: string) =>
			`ws://127.0.0.1:${address.port}/loom/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`,
	}
	return loomBridgeServer
}
