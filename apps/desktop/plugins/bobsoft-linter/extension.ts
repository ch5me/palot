/**
 * BobSoft Linter — extension implementation.
 *
 * Implements `ExtensionModule.activate()`:
 *   - Registers command "bobsoft-linter-greet" that returns a greeting string.
 *   - Registers tool "plugin.bobsoft.linter.read-config" that does a storage
 *     round-trip (get then set) and returns the stored value — proves host-mediated
 *     storage works from the worker side.
 *
 * NO `electron` or `worker_threads` imports — this module is transport-agnostic
 * and reusable on the cloud-host (web) path (CH5 policy, B2 spec constraint).
 */

import type { ExtensionModule, ExtensionContext } from "../../src/shared/firefly-plugin/sdk/index"

const GREETING = "Hello from BobSoft Linter v1.0.0!"
const STORAGE_CONFIG_PREFIX = "config:"

export const activate: ExtensionModule["activate"] = async (ctx: ExtensionContext): Promise<void> => {
	// Register the greet command (manifest id: bobsoft-linter-greet).
	ctx.registerCommand("bobsoft-linter-greet", async (_args) => ({
		message: GREETING,
		pluginId: ctx.pluginId,
		grantedCapabilities: [...ctx.grantedCapabilities],
	}))

	// Register the read-config tool (manifest id: plugin.bobsoft.linter.read-config).
	// Requires net:http (medium-risk) — the consent gate fires before grants are written.
	// Here we use ctx.storage for a round-trip proof; in production this would also
	// make an outbound HTTP request using the granted net:http capability.
	ctx.registerTool("plugin.bobsoft.linter.read-config", async (args) => {
		const key = String(args["key"] ?? "")
		if (!key) {
			return { ok: false, error: "key is required" }
		}
		const storageKey = `${STORAGE_CONFIG_PREFIX}${key}`

		// Read the existing stored value (may be undefined on first call).
		const existing = await ctx.storage.get(storageKey)

		// Write a default value if missing.
		const value = existing ?? `default-value-for-${key}`
		if (existing === undefined) {
			await ctx.storage.set(storageKey, value)
		}

		return {
			ok: true,
			key,
			value,
			fromCache: existing !== undefined,
			pluginId: ctx.pluginId,
		}
	})
}

export const deactivate: ExtensionModule["deactivate"] = async (): Promise<void> => {
	// Nothing to tear down for this lightweight fixture.
}

export default { activate, deactivate } satisfies ExtensionModule
