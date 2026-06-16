// Test fixture: a well-behaved plugin worker. Signals ready (transport-up),
// then waits for the host `activate` message, replies `activated`, and
// heartbeats on a fast cadence so drill tests run quickly.
import { parentPort } from "node:worker_threads"

parentPort.postMessage({ type: "ready" })

parentPort.on("message", (msg) => {
	if (msg && msg.type === "activate") {
		parentPort.postMessage({
			type: "activated",
			pluginId: msg.pluginId,
			registeredCommands: [],
			registeredTools: [],
		})
	}
})

setInterval(() => parentPort.postMessage({ type: "heartbeat" }), 10)
