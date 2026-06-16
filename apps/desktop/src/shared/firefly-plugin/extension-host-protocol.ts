/**
 * Firefly Plugin System V2 — extension-host RPC protocol (design §3, §14)
 *
 * THE wire contract between the host (supervisor side) and a plugin's runtime,
 * wherever that runtime lives — a `node:worker_threads` worker, an Electron
 * `utilityProcess`, or a remote firefly-cloud `cloud-host` over WebSocket. The
 * messages are plain JSON-serializable objects, so the SAME protocol rides any
 * transport (design §2.1: host kind is the contract, location is where it runs).
 *
 * This file is types + Zod schemas + pure parse helpers only — no transport, no
 * Electron, no Node imports — so both the host and the future worker SDK import
 * one source of truth (avoids re-encoding the message shapes per location, smell
 * S10).
 *
 * Generalizes the lifecycle subset that `worker-supervisor.ts` defines today
 * (`ready` / `heartbeat` / `fatal`): that module re-exports
 * `workerLifecycleMessageSchema` from here so there is one definition.
 *
 * Channels:
 *   - lifecycle      worker→host  ready / heartbeat / fatal
 *   - activation     host→worker  activate (with a granted-capability snapshot) / deactivate
 *   - invoke         host→worker  command / tool dispatch  (DEFINED, routing DEFERRED — see note)
 *   - storage        worker→host  get / set / delete / list  (host→worker reply)   [P3e]
 *   - capability     worker→host  request a runtime grant    (host→worker reply)   [P3d]
 *
 * NOTE on invoke routing: built-in command/tool dispatch runs host-side today
 * (`main/firefly-plugin/dispatch.ts`), NOT through a worker. The invoke arms are
 * defined here so the contract is complete and typed, but wiring dispatch to
 * cross the worker boundary is a deliberate later step — these arms have no live
 * producer yet. They are typed contract, never prose.
 */

import { z } from "zod"

import { storageScopeSchema } from "./storage-scopes"

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Correlates a request with its response across the duplex channel. */
export const requestIdSchema = z.string().min(1).max(128)
export type RequestId = z.infer<typeof requestIdSchema>

const jsonValueSchema: z.ZodType<unknown> = z.unknown()

// ---------------------------------------------------------------------------
// Lifecycle (worker → host) — the existing supervisor contract, unified here
// ---------------------------------------------------------------------------

export const workerLifecycleMessageSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("ready") }),
	z.object({ type: z.literal("heartbeat") }),
	z.object({ type: z.literal("fatal"), message: z.string().max(2000) }),
])
export type WorkerLifecycleMessage = z.infer<typeof workerLifecycleMessageSchema>

// ---------------------------------------------------------------------------
// Storage channel (worker → host request, host → worker reply) — P3e
// ---------------------------------------------------------------------------

/**
 * A storage operation a worker asks the host to perform. The host owns the
 * durable store (design: plugin memory is never source of truth); the worker
 * only issues typed requests against a scope it has been granted.
 */
export const storageRequestSchema = z.discriminatedUnion("op", [
	z.object({ op: z.literal("get"), scope: storageScopeSchema, key: z.string().min(1).max(160) }),
	z.object({
		op: z.literal("set"),
		scope: storageScopeSchema,
		key: z.string().min(1).max(160),
		value: jsonValueSchema,
	}),
	z.object({ op: z.literal("delete"), scope: storageScopeSchema, key: z.string().min(1).max(160) }),
	z.object({ op: z.literal("list"), scope: storageScopeSchema }),
])
export type StorageRequest = z.infer<typeof storageRequestSchema>

export const storageResponseSchema = z.discriminatedUnion("ok", [
	z.object({ ok: z.literal(true), value: jsonValueSchema.optional(), keys: z.array(z.string()).optional() }),
	z.object({ ok: z.literal(false), errorCode: z.string(), errorMessage: z.string() }),
])
export type StorageResponse = z.infer<typeof storageResponseSchema>

// ---------------------------------------------------------------------------
// Host → Worker
// ---------------------------------------------------------------------------

export const hostToWorkerMessageSchema = z.discriminatedUnion("type", [
	/**
	 * Bring the worker into service. Carries the snapshot of capability tokens
	 * the host has granted this plugin for this scope, so the worker knows its
	 * powers up front (P3d). The worker replies with a lifecycle `ready`.
	 */
	z.object({
		type: z.literal("activate"),
		pluginId: z.string().min(1).max(200),
		grantedCapabilities: z.array(z.string()).default([]),
		sessionScope: z.enum(["session", "project", "app"]).default("session"),
	}),
	z.object({ type: z.literal("deactivate"), pluginId: z.string().min(1).max(200) }),

	// invoke arms — DEFINED, routing DEFERRED (see file note)
	z.object({
		type: z.literal("invoke-command"),
		requestId: requestIdSchema,
		commandId: z.string().min(1).max(200),
		args: z.record(z.string(), jsonValueSchema).default({}),
		sessionId: z.string().nullable().default(null),
	}),
	z.object({
		type: z.literal("invoke-tool"),
		requestId: requestIdSchema,
		toolId: z.string().min(1).max(200),
		args: z.record(z.string(), jsonValueSchema).default({}),
		sessionId: z.string().nullable().default(null),
	}),

	// replies to worker-originated requests
	z.object({ type: z.literal("storage-response"), requestId: requestIdSchema, response: storageResponseSchema }),
	z.object({
		type: z.literal("capability-response"),
		requestId: requestIdSchema,
		granted: z.boolean(),
		reason: z.string().default(""),
	}),
])
export type HostToWorkerMessage = z.infer<typeof hostToWorkerMessageSchema>

// ---------------------------------------------------------------------------
// Worker → Host
// ---------------------------------------------------------------------------

export const workerToHostMessageSchema = z.discriminatedUnion("type", [
	// lifecycle (mirrors workerLifecycleMessageSchema arms)
	z.object({ type: z.literal("ready") }),
	z.object({ type: z.literal("heartbeat") }),
	z.object({ type: z.literal("fatal"), message: z.string().max(2000) }),

	// result of an invoke-command / invoke-tool (deferred routing)
	z.object({
		type: z.literal("invoke-result"),
		requestId: requestIdSchema,
		ok: z.boolean(),
		data: jsonValueSchema.optional(),
		errorCode: z.string().optional(),
		errorMessage: z.string().optional(),
	}),

	// worker-originated requests the host services
	z.object({ type: z.literal("storage-request"), requestId: requestIdSchema, request: storageRequestSchema }),
	z.object({
		type: z.literal("capability-request"),
		requestId: requestIdSchema,
		capability: z.string().min(1).max(160),
		reason: z.string().max(400).default(""),
	}),
])
export type WorkerToHostMessage = z.infer<typeof workerToHostMessageSchema>

// ---------------------------------------------------------------------------
// Parse helpers — fail-loud (no silent drop). Callers degrade the worker on a
// protocol violation rather than guessing intent.
// ---------------------------------------------------------------------------

export type ParseResult<T> = { ok: true; message: T } | { ok: false; reason: string }

function firstIssue(error: z.ZodError): string {
	return error.issues[0]?.message ?? "invalid message"
}

export function parseWorkerToHostMessage(raw: unknown): ParseResult<WorkerToHostMessage> {
	const parsed = workerToHostMessageSchema.safeParse(raw)
	return parsed.success ? { ok: true, message: parsed.data } : { ok: false, reason: firstIssue(parsed.error) }
}

export function parseHostToWorkerMessage(raw: unknown): ParseResult<HostToWorkerMessage> {
	const parsed = hostToWorkerMessageSchema.safeParse(raw)
	return parsed.success ? { ok: true, message: parsed.data } : { ok: false, reason: firstIssue(parsed.error) }
}

// ---------------------------------------------------------------------------
// RuntimeTransport — the location-agnostic duplex port (design §2.1)
// ---------------------------------------------------------------------------

/**
 * The minimal duplex a runtime location exposes. Implemented by:
 *   - electron-utility / node-worker → over the worker's MessagePort
 *   - cloud-host                     → over a firefly-cloud WebSocket
 *
 * The host speaks `HostToWorkerMessage` and receives raw values it parses with
 * `parseWorkerToHostMessage`. The existing `PluginWorkerHandle`
 * (worker-supervisor.ts) is a lower-level object pipe; a thin adapter lifts a
 * handle into this typed transport (added with the utilityProcess host, P3c).
 */
export interface RuntimeTransport {
	/** Send one typed host→worker message. */
	post(message: HostToWorkerMessage): void
	/** Subscribe to raw inbound values (parse with `parseWorkerToHostMessage`). Returns an unsubscribe. */
	subscribe(listener: (raw: unknown) => void): () => void
	/** Tear the channel down. Idempotent. */
	close(): void | Promise<void>
}
