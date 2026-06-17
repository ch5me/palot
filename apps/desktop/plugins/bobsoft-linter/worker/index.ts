/**
 * BobSoft Linter — worker entry point.
 *
 * Thin entry: adapts Node `parentPort` to the `WorkerRuntimePort` interface
 * expected by `runExtensionWorker`, then delegates everything to the runtime.
 *
 * The bundler (build-plugins.ts, `external: []`) inlines the runtime + SDK
 * into worker.mjs — the output is fully self-contained, no external imports.
 *
 * NO business logic here — all extension code lives in `../extension.ts`.
 */

import { parentPort } from "node:worker_threads"
import { runExtensionWorker, type WorkerRuntimePort } from "../../../src/main/firefly-plugin/extension-worker-runtime"
import * as ext from "../extension"

if (!parentPort) {
	throw new Error("bobsoft-linter worker: must be run as a Node worker thread (parentPort is null)")
}

// Adapt the Node MessagePort to the injected WorkerRuntimePort contract.
// runExtensionWorker is transport-agnostic; it never imports parentPort directly.
const port: WorkerRuntimePort = {
	post(message: unknown): void {
		parentPort!.postMessage(message)
	},
	onMessage(listener: (raw: unknown) => void): () => void {
		const handler = (msg: unknown): void => listener(msg)
		parentPort!.on("message", handler)
		return () => parentPort!.off("message", handler)
	},
}

// Signal the host that the transport is up (ready), then wait for `activate`.
parentPort.postMessage({ type: "ready" })

// Start the extension runtime. It will respond to `activate` → post `activated`,
// and dispatch `invoke-command` / `invoke-tool` messages to the registered handlers.
await runExtensionWorker({
	port,
	importMain: async () => ext,
})
