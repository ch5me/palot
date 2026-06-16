/**
 * Firefly Plugin System V2 — worker-side extension runtime.
 *
 * Receives host→worker protocol messages over an injected port, invokes
 * the extension module's lifecycle hooks, and routes command/tool calls
 * to registered handlers.
 *
 * NO `electron` and NO `worker_threads` imports — the port is injected so
 * this module is transport-agnostic (reused by the future web/cloud-host
 * and by tests with fake ports).
 *
 * Fail-loud contract (CH5 policy):
 *   - `activate()` throwing → post `fatal`, NEVER post `activated`.
 *   - Unknown command/tool id → `invoke-result` with `ok:false, errorCode:"handler_not_found"`.
 *   - Unknown message type → silently ignored (forward-compat).
 */

import type { ExtensionModule, ExtensionContext, SessionScope } from "../../shared/firefly-plugin/sdk/index"
import { createStorageBridge, createCapabilitiesBridge, dispatchHostResponse } from "../../shared/firefly-plugin/sdk/host-bridge"

// ---------------------------------------------------------------------------
// Injected port interface (no direct import of parentPort)
// ---------------------------------------------------------------------------

export interface WorkerRuntimePort {
	/** Post a raw message to the host. */
	post(message: unknown): void
	/** Register a message listener. Listener receives the raw message value. Returns unsubscribe. */
	onMessage(listener: (raw: unknown) => void): () => void
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface RunExtensionWorkerOptions {
	/** Injected message port — never imported from worker_threads directly. */
	port: WorkerRuntimePort
	/** Returns the extension module to activate. May be async (dynamic import). */
	importMain(): Promise<ExtensionModule>
}

export async function runExtensionWorker({ port, importMain }: RunExtensionWorkerOptions): Promise<void> {
	const commandHandlers = new Map<string, (args: Record<string, unknown>) => unknown | Promise<unknown>>()
	const toolHandlers = new Map<string, (args: Record<string, unknown>) => unknown | Promise<unknown>>()

	let activatedModule: ExtensionModule | null = null

	// Wire inbound messages from the host.
	port.onMessage(async (raw: unknown) => {
		// Dispatch storage/capability responses to the host-bridge RPC layer.
		dispatchHostResponse(raw)

		if (raw === null || typeof raw !== "object") return
		const msg = raw as Record<string, unknown>

		switch (msg["type"]) {
			case "activate": {
				const pluginId = String(msg["pluginId"] ?? "")
				const grantedCapabilities: readonly string[] = Array.isArray(msg["grantedCapabilities"])
					? (msg["grantedCapabilities"] as string[])
					: []
				const sessionScope = (msg["sessionScope"] ?? "session") as SessionScope

				try {
					const mod = await importMain()

					const ctx: ExtensionContext = {
						pluginId,
						grantedCapabilities,
						sessionScope,
						registerCommand(id: string, handler) {
							commandHandlers.set(id, handler)
						},
						registerTool(id: string, handler) {
							toolHandlers.set(id, handler)
						},
						storage: createStorageBridge(port),
						capabilities: createCapabilitiesBridge(port),
					}

					await mod.activate(ctx)
					activatedModule = mod

					port.post({
						type: "activated",
						pluginId,
						registeredCommands: [...commandHandlers.keys()],
						registeredTools: [...toolHandlers.keys()],
					})
				} catch (err) {
					port.post({
						type: "fatal",
						message: err instanceof Error ? err.message : String(err),
					})
				}
				break
			}

			case "invoke-command": {
				const requestId = String(msg["requestId"] ?? "")
				const targetId = String(msg["commandId"] ?? "")
				const args = (typeof msg["args"] === "object" && msg["args"] !== null
					? msg["args"]
					: {}) as Record<string, unknown>

				const handler = commandHandlers.get(targetId)
				if (!handler) {
					port.post({
						type: "invoke-result",
						requestId,
						ok: false,
						errorCode: "handler_not_found",
						errorMessage: `No command handler registered for id "${targetId}"`,
					})
					break
				}
				try {
					const data = await handler(args)
					port.post({ type: "invoke-result", requestId, ok: true, data })
				} catch (err) {
					port.post({
						type: "invoke-result",
						requestId,
						ok: false,
						errorCode: "handler_error",
						errorMessage: err instanceof Error ? err.message : String(err),
					})
				}
				break
			}

			case "invoke-tool": {
				const requestId = String(msg["requestId"] ?? "")
				const targetId = String(msg["toolId"] ?? "")
				const args = (typeof msg["args"] === "object" && msg["args"] !== null
					? msg["args"]
					: {}) as Record<string, unknown>

				const handler = toolHandlers.get(targetId)
				if (!handler) {
					port.post({
						type: "invoke-result",
						requestId,
						ok: false,
						errorCode: "handler_not_found",
						errorMessage: `No tool handler registered for id "${targetId}"`,
					})
					break
				}
				try {
					const data = await handler(args)
					port.post({ type: "invoke-result", requestId, ok: true, data })
				} catch (err) {
					port.post({
						type: "invoke-result",
						requestId,
						ok: false,
						errorCode: "handler_error",
						errorMessage: err instanceof Error ? err.message : String(err),
					})
				}
				break
			}

			case "deactivate": {
				try {
					await activatedModule?.deactivate?.()
				} finally {
					// Signal clean exit — host will tear down the worker.
					port.post({ type: "ready" }) // transport-level ack; host closes the worker
				}
				break
			}

			default:
				// Forward-compat: unknown message types are silently ignored.
				break
		}
	})
}
