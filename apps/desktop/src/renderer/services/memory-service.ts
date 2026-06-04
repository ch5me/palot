/**
 * Memory service — supports local, remote, and hybrid modes.
 *
 * - Local: pinnedFactsAtom in localStorage (current behavior)
 * - Remote: Cloudflare memory API (remember, recall, list, forget)
 * - Hybrid: merges local pinned facts with remote memories
 */

import type { PinnedFact } from "../atoms/preferences"

// ============================================================
// Types
// ============================================================

export type MemoryMode = "local" | "hybrid" | "remote"

export interface MemoryItem {
	id: string
	body: string
	memoryClass: string
	topicKey?: string
	createdAt: string
	updatedAt: string
	source: "local" | "remote"
	metadata?: Record<string, string | number | boolean>
}

export interface MemoryServiceConfig {
	mode: MemoryMode
	apiBaseUrl: string
	projectId: string
	userId: string
}

// ============================================================
// Cloudflare Memory API client
// ============================================================

const HOSTED_API_VERSION = "1" as const

interface CloudflareProfile {
	readonly projectId: string
	readonly userId: string
}

interface RememberRequest {
	readonly apiVersion: typeof HOSTED_API_VERSION
	readonly profile: CloudflareProfile
	readonly memory: {
		readonly memoryClass: string
		readonly body: string
		readonly topicKey?: string
		readonly metadata?: Record<string, string | number | boolean>
	}
}

interface RecallRequest {
	readonly apiVersion: typeof HOSTED_API_VERSION
	readonly profile: CloudflareProfile
	readonly query: string
	readonly limit?: number
}

interface ListRequest {
	readonly apiVersion: typeof HOSTED_API_VERSION
	readonly profile: CloudflareProfile
	readonly filter?: {
		readonly classes?: readonly string[]
	}
	readonly pagination?: {
		readonly pageSize: number
		readonly cursor?: string
	}
}

interface ForgetRequest {
	readonly apiVersion: typeof HOSTED_API_VERSION
	readonly profile: CloudflareProfile
	readonly target: { readonly memoryId: string }
	readonly reason?: string
}

interface MemoryRecord {
	readonly memoryId: string
	readonly memoryClass: string
	readonly body: string
	readonly topicKey?: string
	readonly createdAt: string
	readonly updatedAt: string
	readonly metadata?: Record<string, string | number | boolean>
}

interface HostedEnvelope<T> {
	readonly apiVersion: string
	readonly traceId: string
	readonly data: T
}

async function cloudflareRequest<T>(
	baseUrl: string,
	path: string,
	body: unknown,
): Promise<T> {
	const response = await fetch(`${baseUrl}${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	})
	if (!response.ok) {
		const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
		throw new Error(error.error?.message ?? `Cloudflare memory API error: ${response.status}`)
	}
	const envelope: HostedEnvelope<T> = await response.json()
	return envelope.data
}

export async function cloudflareRemember(
	config: MemoryServiceConfig,
	body: string,
	topicKey?: string,
): Promise<MemoryRecord> {
	return cloudflareRequest<MemoryRecord>(config.apiBaseUrl, "/v1/remember", {
		apiVersion: HOSTED_API_VERSION,
		profile: { projectId: config.projectId, userId: config.userId },
		memory: {
			memoryClass: "fact",
			body,
			topicKey,
		},
	} satisfies RememberRequest)
}

export async function cloudflareRecall(
	config: MemoryServiceConfig,
	query: string,
	limit = 20,
): Promise<MemoryRecord[]> {
	const result = await cloudflareRequest<{ evidence: readonly { memory: MemoryRecord }[] }>(
		config.apiBaseUrl,
		"/v1/recall",
		{
			apiVersion: HOSTED_API_VERSION,
			profile: { projectId: config.projectId, userId: config.userId },
			query,
			limit,
		} satisfies RecallRequest,
	)
	return result.evidence.map((e) => e.memory)
}

export async function cloudflareList(
	config: MemoryServiceConfig,
	pageSize = 50,
): Promise<MemoryRecord[]> {
	const result = await cloudflareRequest<{ items: readonly MemoryRecord[] }>(
		config.apiBaseUrl,
		"/v1/list",
		{
			apiVersion: HOSTED_API_VERSION,
			profile: { projectId: config.projectId, userId: config.userId },
			pagination: { pageSize },
		} satisfies ListRequest,
	)
	return [...result.items]
}

export async function cloudflareForget(
	config: MemoryServiceConfig,
	memoryId: string,
	reason?: string,
): Promise<void> {
	await cloudflareRequest<{ invalidatedCount: number }>(config.apiBaseUrl, "/v1/forget", {
		apiVersion: HOSTED_API_VERSION,
		profile: { projectId: config.projectId, userId: config.userId },
		target: { memoryId },
		reason,
	} satisfies ForgetRequest)
}

// ============================================================
// Unified service
// ============================================================

function localFactToMemoryItem(fact: PinnedFact, projectKey: string): MemoryItem {
	return {
		id: fact.id,
		body: fact.text,
		memoryClass: "fact",
		topicKey: `project:${projectKey}`,
		createdAt: new Date(fact.createdAt).toISOString(),
		updatedAt: new Date(fact.createdAt).toISOString(),
		source: "local",
	}
}

function cloudflareRecordToMemoryItem(record: MemoryRecord): MemoryItem {
	return {
		id: record.memoryId,
		body: record.body,
		memoryClass: record.memoryClass,
		topicKey: record.topicKey,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
		source: "remote",
		metadata: record.metadata,
	}
}

export async function fetchMemories(
	config: MemoryServiceConfig,
	localFacts: PinnedFact[],
	projectKey: string,
	query?: string,
): Promise<MemoryItem[]> {
	const localItems = localFacts.map((f) => localFactToMemoryItem(f, projectKey))

	if (config.mode === "local") {
		return localItems
	}

	try {
		const remoteItems = query
			? (await cloudflareRecall(config, query)).map(cloudflareRecordToMemoryItem)
			: (await cloudflareList(config)).map(cloudflareRecordToMemoryItem)

		if (config.mode === "remote") {
			return remoteItems
		}

		// Hybrid: merge local + remote, deduplicate by body
		const seenBodies = new Set(localItems.map((i) => i.body.toLowerCase()))
		const uniqueRemote = remoteItems.filter((i) => !seenBodies.has(i.body.toLowerCase()))
		return [...localItems, ...uniqueRemote]
	} catch {
		// Remote failed — fall back to local only
		return localItems
	}
}

export async function addRemoteMemory(
	config: MemoryServiceConfig,
	body: string,
	topicKey?: string,
): Promise<MemoryItem> {
	const record = await cloudflareRemember(config, body, topicKey)
	return cloudflareRecordToMemoryItem(record)
}

export async function removeRemoteMemory(
	config: MemoryServiceConfig,
	memoryId: string,
): Promise<void> {
	await cloudflareForget(config, memoryId, "user deleted from elf memory panel")
}
