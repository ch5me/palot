// Test fixture: a plugin worker that activates (replies activated), then
// crashes shortly after — the runtime-crash drill. The supervisor must
// restart it with backoff and quarantine it once the crash threshold trips.
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
		parentPort.postMessage({ type: "heartbeat" })
		setTimeout(() => {
			process.exit(7)
		}, 15)
	}
})
