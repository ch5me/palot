/**
 * Firefly Plugin SDK — VS Code-modeled extension API surface.
 *
 * This module is transport-agnostic and has NO imports from `electron`,
 * `worker_threads`, or any Node-only API. It exposes pure types and the
 * `ExtensionContext` shape that the worker-side runtime hands to each plugin.
 */

/** Invocable command handler registered by an extension. */
export type CommandHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>

/** Invocable tool handler registered by an extension. */
export type ToolHandler = (args: Record<string, unknown>) => unknown | Promise<unknown>

/** Session scope narrowing — mirrors the protocol enum. */
export type SessionScope = "session" | "project" | "app"

/**
 * Host-mediated durable storage for the extension.
 * All operations are async (RPC to the host store).
 */
export interface ExtensionStorage {
	/** Read a key from the app-scope store (or `undefined` if absent). */
	get(key: string): Promise<unknown>
	/** Write a key/value pair to the app-scope store. */
	set(key: string, value: unknown): Promise<void>
	/** Delete a key from the app-scope store. */
	delete(key: string): Promise<void>
	/** List all keys in the app-scope store owned by this plugin. */
	list(): Promise<readonly string[]>
}

/**
 * Runtime capability negotiation. Extensions declare required capabilities
 * in their manifest; `capabilities.request` lets them confirm/gate at
 * runtime without storing tokens.
 */
export interface ExtensionCapabilities {
	/** Check whether `capabilityToken` is currently granted. Returns the grant status. */
	request(capabilityToken: string): Promise<{ granted: boolean; reason: string }>
}

/**
 * The context object passed to `ExtensionModule.activate()`.
 * Mirrors VS Code's `ExtensionContext` surface, but backed by Firefly's
 * host-mediated RPC rather than the Node `globalThis` directly.
 */
export interface ExtensionContext {
	/** Stable plugin identifier (namespace.name). */
	readonly pluginId: string

	/**
	 * The capability tokens granted to this plugin for the current session,
	 * resolved at activation time. Use `capabilities.request()` for a live check.
	 */
	readonly grantedCapabilities: readonly string[]

	/** The activation scope for this session. */
	readonly sessionScope: SessionScope

	/**
	 * Register a command handler by id. Only callable during `activate()` —
	 * the host seeds the routing table from the ids collected after activation.
	 */
	registerCommand(id: string, handler: CommandHandler): void

	/**
	 * Register a tool handler by id. Same lifecycle constraint as `registerCommand`.
	 */
	registerTool(id: string, handler: ToolHandler): void

	/** Host-mediated durable storage. */
	readonly storage: ExtensionStorage

	/** Runtime capability negotiation. */
	readonly capabilities: ExtensionCapabilities
}

/**
 * The shape every Firefly extension module must export.
 * The runtime calls `activate` on load and `deactivate` on teardown.
 */
export interface ExtensionModule {
	activate(ctx: ExtensionContext): void | Promise<void>
	deactivate?(): void | Promise<void>
}
