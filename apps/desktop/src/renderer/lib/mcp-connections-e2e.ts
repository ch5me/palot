import type { McpVerificationSnapshot } from "./mcp-connections-verification"
import { summarizeMcpVerification } from "./mcp-connections-verification"

export interface McpE2eRecord {
	name: string
	authState?: string
	testState?: string
	status?: string
	runtimeState?: string
	transport?: string
	target?: string | null
	lastHealthyAt?: string | null
	canonicalStore?: string
	ownershipMode?: string
	restorePolicy?: string
}

export interface McpDuplicateConnectionFamily {
	identity: string
	names: string[]
}

export interface McpE2eSnapshot {
	connectionsRoute: string
	connectionsLabel: string
	pluginSummary: McpVerificationSnapshot
	activeConnectionNames: string[]
	gatewayConnectionNames: string[]
	duplicateConnectionFamilies: McpDuplicateConnectionFamily[]
	domReadiness?: McpConnectionsDomReadiness
}

export interface McpConnectionsDomInput {
	visibleText?: string
	domSnapshot?: string
}

export interface McpConnectionsDomSignal {
	id: string
	kind: "positive" | "blocker"
	matched: boolean
	source: "visibleText" | "domSnapshot"
	weight: number
}

export interface McpConnectionsDomReadiness {
	ready: boolean
	threshold: number
	positiveScore: number
	blockerScore: number
	matchedSignals: McpConnectionsDomSignal[]
}

const DOM_READINESS_THRESHOLD_WITH_VISIBLE_TEXT = 6
const DOM_READINESS_THRESHOLD_WITHOUT_VISIBLE_TEXT = 3

const DOM_POSITIVE_SIGNALS = [
	{ id: "connections-heading", source: "visibleText", tokens: ["connections"], weight: 3 },
	{
		id: "connections-copy",
		source: "visibleText",
		tokens: ["connect mcp servers for docs, data, and runtime actions without leaving elf."],
		weight: 3,
	},
	{ id: "browse-catalog", source: "visibleText", tokens: ["browse mcp catalog"], weight: 2 },
	{
		id: "connection-actions",
		source: "visibleText",
		tokens: ["test connection", "connect"],
		weight: 2,
		match: "any",
	},
	{ id: "notion-card", source: "visibleText", tokens: ["notion"], weight: 1 },
	{ id: "connections-heading-snapshot", source: "domSnapshot", tokens: ["connections"], weight: 1 },
	{
		id: "browse-catalog-snapshot",
		source: "domSnapshot",
		tokens: ["browse mcp catalog"],
		weight: 1,
	},
	{
		id: "connection-actions-snapshot",
		source: "domSnapshot",
		tokens: ["test connection", "connect"],
		weight: 1,
		match: "any",
	},
] as const

const DOM_BLOCKER_SIGNALS = [
	{ id: "loading-projects", source: "visibleText", tokens: ["loading projects..."], weight: 10 },
	{ id: "starting-server", source: "visibleText", tokens: ["starting server..."], weight: 10 },
	{ id: "connecting", source: "visibleText", tokens: ["connecting..."], weight: 8 },
	{ id: "loading-sessions", source: "visibleText", tokens: ["loading sessions..."], weight: 8 },
	{ id: "connection-failed", source: "visibleText", tokens: ["connection failed"], weight: 10 },
] as const

function normalizeDomText(value: string | undefined): string {
	return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? ""
}

function matchesTokens(
	haystack: string,
	tokens: readonly string[],
	mode: "all" | "any" = "all",
): boolean {
	if (!haystack) return false
	if (mode === "any") return tokens.some((token) => haystack.includes(token))
	return tokens.every((token) => haystack.includes(token))
}

export function assessMcpConnectionsDomReadiness(
	input: McpConnectionsDomInput,
): McpConnectionsDomReadiness {
	const visibleText = normalizeDomText(input.visibleText)
	const domSnapshot = normalizeDomText(input.domSnapshot)
	const threshold = visibleText
		? DOM_READINESS_THRESHOLD_WITH_VISIBLE_TEXT
		: DOM_READINESS_THRESHOLD_WITHOUT_VISIBLE_TEXT
	const matchedSignals: McpConnectionsDomSignal[] = []
	let positiveScore = 0
	let blockerScore = 0

	for (const signal of DOM_POSITIVE_SIGNALS) {
		const haystack = signal.source === "visibleText" ? visibleText : domSnapshot
		const matched = matchesTokens(
			haystack,
			signal.tokens,
			"match" in signal && signal.match === "any" ? "any" : "all",
		)
		matchedSignals.push({
			id: signal.id,
			kind: "positive",
			matched,
			source: signal.source,
			weight: signal.weight,
		})
		if (matched) positiveScore += signal.weight
	}

	for (const signal of DOM_BLOCKER_SIGNALS) {
		const matched = matchesTokens(visibleText, signal.tokens)
		matchedSignals.push({
			id: signal.id,
			kind: "blocker",
			matched,
			source: signal.source,
			weight: signal.weight,
		})
		if (matched) blockerScore += signal.weight
	}

	return {
		ready: blockerScore === 0 && positiveScore >= threshold,
		threshold,
		positiveScore,
		blockerScore,
		matchedSignals: matchedSignals.filter((signal) => signal.matched),
	}
}

function normalizeTarget(target: string) {
	const trimmed = target.trim()
	if (!trimmed) return trimmed
	try {
		const url = new URL(trimmed)
		url.hostname = url.hostname.toLowerCase()
		url.hash = ""
		if (url.pathname !== "/" && url.pathname.endsWith("/")) {
			url.pathname = url.pathname.slice(0, -1)
		}
		return url.toString()
	} catch {
		return trimmed.replace(/\/+$/g, "")
	}
}

function resolveRecordIdentity(record: McpE2eRecord) {
	if (record.transport === "local-stdio") {
		return `local:${record.target?.trim() ?? record.name}`
	}
	if (record.target?.trim()) {
		return `remote:${normalizeTarget(record.target)}`
	}
	return `name:${record.name}`
}

function collectDuplicateConnectionFamilies(records: McpE2eRecord[]): McpDuplicateConnectionFamily[] {
	const grouped = new Map<string, string[]>()
	for (const record of records) {
		const identity = resolveRecordIdentity(record)
		const names = grouped.get(identity) ?? []
		names.push(record.name)
		grouped.set(identity, names)
	}
	return Array.from(grouped.entries())
		.filter(([, names]) => names.length > 1)
		.map(([identity, names]) => ({ identity, names: [...names].sort() }))
		.sort((a, b) => a.identity.localeCompare(b.identity))
}

export function buildMcpE2eSnapshot(
	records: McpE2eRecord[],
	domInput?: McpConnectionsDomInput,
): McpE2eSnapshot {
	const pluginSummary = summarizeMcpVerification(records)
	return {
		connectionsRoute: "/settings/connections",
		connectionsLabel: "Connections",
		pluginSummary,
		activeConnectionNames: records
			.filter((record) => record.runtimeState === "active" || Boolean(record.lastHealthyAt))
			.map((record) => record.name),
		gatewayConnectionNames: records
			.filter((record) => record.canonicalStore === "gateway")
			.map((record) => record.name),
		duplicateConnectionFamilies: collectDuplicateConnectionFamilies(records),
		...(domInput ? { domReadiness: assessMcpConnectionsDomReadiness(domInput) } : {}),
	}
}
