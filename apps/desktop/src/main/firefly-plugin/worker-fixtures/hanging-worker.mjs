// Test fixture: a plugin worker that activates (replies activated), then
// stops heartbeating — the hang drill. The supervisor's hang scan must
// kill + restart it, and quarantine after the hang streak threshold.
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
		// ... then silence forever (event loop kept alive, no heartbeats).
	}
})

// Keep the event loop alive even before the activate arrives.
setInterval(() => {}, 60_000)
