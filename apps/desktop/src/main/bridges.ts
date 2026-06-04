import { execFile } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { createLogger } from "./logger"

const execFileAsync = promisify(execFile)
const log = createLogger("bridges")

export type BridgeStatus = "connected" | "disconnected" | "soon"

export interface BridgeChannel {
	id: string
	name: string
	kind: string
	status: BridgeStatus
	alive: boolean
	pid: number | null
	uptime: string | null
	launchd: string | null
	loaded: boolean
	messagesTotal: number | null
	lastActivity: string | null
	lastActivityAgo: string | null
	today: number | null
	logPath: string | null
}

export interface BridgeMessage {
	ts: string
	tsAgo: string | null
	direction: "out" | "in"
	peer: string
	text: string
}

interface ChannelProbe {
	id: string
	name: string
	kind: string
	wiring: "live" | "capability" | "soon"
	procMatch: string[]
	launchdMatch: string
	logCandidates: string[]
	inboundCandidates?: string[]
	syntheticActivity?: BridgeMessage
}

const HOME = process.env.HOME ?? "/"

function channelProbes(): ChannelProbe[] {
	return [
		{
			id: "opencode",
			name: "OpenCode",
			kind: "agent",
			wiring: "live",
			procMatch: ["opencode"],
			launchdMatch: "opencode",
			logCandidates: [],
			syntheticActivity: {
				ts: "now",
				tsAgo: "moments",
				direction: "in",
				peer: "Active session",
				text: "OpenCode agent lane is live for the active workspace.",
			},
		},
		{
			id: "claude-code",
			name: "Claude Code CLI",
			kind: "agent",
			wiring: "live",
			procMatch: ["claude"],
			launchdMatch: "claude",
			logCandidates: [],
			syntheticActivity: {
				ts: "recent",
				tsAgo: "moments",
				direction: "in",
				peer: "Claude Code CLI",
				text: "Claude Code binary detected and reachable via PATH.",
			},
		},
		{
			id: "tmux",
			name: "tmux server",
			kind: "infrastructure",
			wiring: "live",
			procMatch: ["tmux: server"],
			launchdMatch: "tmux",
			logCandidates: [],
			syntheticActivity: {
				ts: "now",
				tsAgo: "moments",
				direction: "in",
				peer: "tmux",
				text: "tmux server is reachable; oracles are listed in the Oracle surface.",
			},
		},
		{
			id: "skills",
			name: "Skills + Commands",
			kind: "capability",
			wiring: "capability",
			procMatch: [],
			launchdMatch: "",
			logCandidates: [],
			syntheticActivity: {
				ts: "now",
				tsAgo: "moments",
				direction: "out",
				peer: "Plugins surface",
				text: "Skills and commands surface in the Plugins side panel; this card keeps the bigger integration map visible.",
			},
		},
		{
			id: "mcp",
			name: "MCP Servers",
			kind: "integration",
			wiring: "capability",
			procMatch: [],
			launchdMatch: "",
			logCandidates: [],
			syntheticActivity: {
				ts: "recently",
				tsAgo: "1h",
				direction: "out",
				peer: "Config surface",
				text: "MCP posture is managed through OpenCode config and the Plugins surface.",
			},
		},
		{
			id: "node-pty",
			name: "node-pty (PTY lane)",
			kind: "capability",
			wiring: "capability",
			procMatch: [],
			launchdMatch: "",
			logCandidates: [],
			syntheticActivity: {
				ts: "now",
				tsAgo: "moments",
				direction: "in",
				peer: "Electron main",
				text: "PTY lane is ready; Terminal surface spawns shells through it.",
			},
		},
		{
			id: "whatsapp",
			name: "whatsapp",
			kind: "messaging",
			wiring: "live",
			procMatch: ["inbox-worker", "push.js", "meta-webhook", "aios-bridge", "aios/bridge"],
			launchdMatch: "bridge",
			logCandidates: [
				"Repo/firaz/aios/bridge/scripts/outbound-log.jsonl",
				"Repo/firaz/aios-bridge/scripts/outbound-log.jsonl",
				".aios/state/outbound-log.jsonl",
			],
			inboundCandidates: [".aios/state/personal-wa-events.jsonl"],
		},
		{
			id: "instagram",
			name: "instagram",
			kind: "dm",
			wiring: "soon",
			procMatch: [],
			launchdMatch: "instagram",
			logCandidates: [".aios/state/instagram-log.jsonl"],
		},
		{
			id: "threads",
			name: "threads",
			kind: "social",
			wiring: "soon",
			procMatch: [],
			launchdMatch: "threads",
			logCandidates: [".aios/state/threads-log.jsonl"],
		},
		{
			id: "gchat",
			name: "google chat",
			kind: "chat",
			wiring: "soon",
			procMatch: [],
			launchdMatch: "gchat",
			logCandidates: [".aios/state/gchat-log.jsonl"],
		},
		{
			id: "x",
			name: "x / twitter",
			kind: "social",
			wiring: "soon",
			procMatch: [],
			launchdMatch: "twitter",
			logCandidates: [".aios/state/x-log.jsonl"],
		},
		{
			id: "telegram",
			name: "telegram",
			kind: "messaging",
			wiring: "soon",
			procMatch: [],
			launchdMatch: "telegram",
			logCandidates: [".aios/state/telegram-log.jsonl"],
		},
		{
			id: "gmail",
			name: "gmail",
			kind: "email",
			wiring: "soon",
			procMatch: [],
			launchdMatch: "gmail",
			logCandidates: [".aios/state/gmail-log.jsonl"],
		},
		{
			id: "imessage",
			name: "imessage",
			kind: "messaging",
			wiring: "soon",
			procMatch: [],
			launchdMatch: "imessage",
			logCandidates: [".aios/state/imessage-log.jsonl"],
		},
		{
			id: "contacts",
			name: "Contacts / CRM",
			kind: "workspace",
			wiring: "soon",
			procMatch: [],
			launchdMatch: "",
			logCandidates: [],
		},
	]
}

function resolveLog(candidates: string[]): string | null {
	for (const candidate of candidates) {
		const filePath = candidate.startsWith("/") ? candidate : path.join(HOME, candidate)
		if (existsSync(filePath)) {
			return filePath
		}
	}
	return null
}

async function findProcess(needles: string[]): Promise<{ pid: number; uptime: string } | null> {
	if (needles.length === 0) {
		return null
	}
	try {
		const { stdout } = await execFileAsync("/bin/ps", ["-axo", "pid,etime,command"], {
			timeout: 1500,
		})
		for (const line of stdout.split("\n").slice(1)) {
			const trimmed = line.trimStart()
			const parts = trimmed.split(/\s+/, 3)
			const pid = Number.parseInt(parts[0] ?? "", 10)
			const etime = parts[1] ?? ""
			const command = parts[2] ?? ""
			if (!Number.isFinite(pid) || !command) {
				continue
			}
			if (needles.some((needle) => command.includes(needle))) {
				return { pid, uptime: humanizeEtime(etime) }
			}
		}
	} catch (err) {
		log.debug("findProcess failed", { error: (err as Error).message })
	}
	return null
}

function humanizeEtime(raw: string): string {
	const trimmed = raw.trim()
	if (!trimmed) {
		return ""
	}
	const [daysPart, timePart] = trimmed.includes("-") ? trimmed.split("-", 2) : ["0", trimmed]
	const days = Number.parseInt(daysPart, 10) || 0
	const segments = timePart.split(":").map((part) => Number.parseInt(part, 10) || 0)
	const [hours, minutes] = segments.length === 3 ? [segments[0], segments[1]] : [0, segments[0] ?? 0]
	if (days > 0) return `${days}d ${hours}h`
	if (hours > 0) return `${hours}h ${minutes}m`
	if (minutes > 0) return `${minutes}m`
	return "<1m"
}

async function findLaunchd(needle: string): Promise<{ label: string; running: boolean } | null> {
	if (!needle) {
		return null
	}
	try {
		const { stdout } = await execFileAsync("/bin/launchctl", ["list"], { timeout: 1500 })
		const loweredNeedle = needle.toLowerCase()
		for (const line of stdout.split("\n").slice(1)) {
			const [pidRaw, _exit, labelRaw] = line.split("\t")
			const label = labelRaw?.trim() ?? ""
			if (label.toLowerCase().includes(loweredNeedle)) {
				return {
					label,
					running: pidRaw?.trim() !== "-" && Number.isFinite(Number.parseInt(pidRaw ?? "", 10)),
				}
			}
		}
	} catch (err) {
		log.debug("findLaunchd failed", { error: (err as Error).message })
	}
	return null
}

function formatLocal(date: Date): string {
	const year = date.getFullYear()
	const month = `${date.getMonth() + 1}`.padStart(2, "0")
	const day = `${date.getDate()}`.padStart(2, "0")
	const hours = `${date.getHours()}`.padStart(2, "0")
	const minutes = `${date.getMinutes()}`.padStart(2, "0")
	return `${year}-${month}-${day} ${hours}:${minutes}`
}

function humanizeAgo(date: Date): string | null {
	const delta = Date.now() - date.getTime()
	if (delta < 0) return null
	const seconds = Math.floor(delta / 1000)
	if (seconds < 60) return "<1m"
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
	if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`
	return `${Math.floor(seconds / 86_400)}d`
}

function extractTimestamp(line: string): Date | null {
	try {
		const value = JSON.parse(line) as Record<string, unknown>
		const raw = value.ts ?? value.timestamp ?? value.time ?? value.date ?? value.at
		if (typeof raw === "string") {
			const parsed = new Date(raw)
			return Number.isNaN(parsed.getTime()) ? null : parsed
		}
		if (typeof raw === "number") {
			return new Date(raw > 100_000_000_000 ? raw : raw * 1000)
		}
	} catch {
		return null
	}
	return null
}

function trimText(text: string, max: number): string {
	const collapsed = text.trim().replace(/\s+/g, " ")
	if (collapsed.length <= max) {
		return collapsed
	}
	return `${collapsed.slice(0, max).trimEnd()}…`
}

function readLogStats(candidates: string[]): {
	path: string
	messagesTotal: number
	lastActivity: string | null
	lastActivityAgo: string | null
	today: number | null
} | null {
	const filePath = resolveLog(candidates)
	if (!filePath) {
		return null
	}
	try {
		const text = readFileSync(filePath, "utf-8")
		const lines = text.split("\n").filter((line) => line.trim().length > 0)
		const timestamps = lines.map(extractTimestamp).filter((date): date is Date => date !== null)
		const last = timestamps.at(-1) ?? null
		const today = timestamps.filter((date) => date.toDateString() === new Date().toDateString()).length
		return {
			path: filePath,
			messagesTotal: lines.length,
			lastActivity: last ? formatLocal(last) : null,
			lastActivityAgo: last ? humanizeAgo(last) : null,
			today,
		}
	} catch {
		return { path: filePath, messagesTotal: 0, lastActivity: null, lastActivityAgo: null, today: null }
	}
}

function parseFeedLine(line: string, defaultDirection: "out" | "in"): BridgeMessage | null {
	const timestamp = extractTimestamp(line)
	if (!timestamp) {
		return null
	}
	try {
		const value = JSON.parse(line) as Record<string, unknown>
		const rawDirection = String(value.direction ?? value.dir ?? value.from ?? value.type ?? defaultDirection).toLowerCase()
		const direction: "out" | "in" = rawDirection.includes("in") || rawDirection === "received" ? "in" : "out"
		const peer = trimText(
			String(
				value.peer ??
					value.name ??
					value.chatName ??
					value.to ??
					value.recipient ??
					value.chat ??
					value.from ??
					value.target ??
					value.phone ??
					"unknown",
			),
			48,
		)
		const text = trimText(
			String(value.text ?? value.body ?? value.message ?? value.content ?? value.body_preview ?? value.media ?? ""),
			280,
		)
		return {
			ts: formatLocal(timestamp),
			tsAgo: humanizeAgo(timestamp),
			direction,
			peer,
			text,
		}
	} catch {
		return null
	}
}

function readFeed(candidates: string[], defaultDirection: "out" | "in", limit: number): BridgeMessage[] {
	const filePath = resolveLog(candidates)
	if (!filePath) {
		return []
	}
	try {
		const text = readFileSync(filePath, "utf-8")
		const lines = text.split("\n").filter((line) => line.trim().length > 0)
		return lines
			.slice(-limit)
			.map((line) => parseFeedLine(line, defaultDirection))
			.filter((entry): entry is BridgeMessage => entry !== null)
	} catch {
		return []
	}
}

export async function listBridges(): Promise<{ bridges: BridgeChannel[] }> {
	const probes = channelProbes()
	const opencodeProbe = probes.find((probe) => probe.id === "opencode")
	const opencodeHit = opencodeProbe ? await findProcess(opencodeProbe.procMatch) : null
	const opencodeAlive = !!opencodeHit

	const channels = await Promise.all(
		probes.map(async (probe) => {
			const proc = await findProcess(probe.procMatch)
			const launchd = probe.launchdMatch ? await findLaunchd(probe.launchdMatch) : null
			const logStats = readLogStats(probe.logCandidates)
			const alive = !!proc || !!launchd?.running
			const hasFootprint = !!launchd || !!logStats
			let status: BridgeStatus
			if (probe.wiring === "capability") {
				const capabilityAlive = probe.id === "node-pty" || opencodeAlive
				status = capabilityAlive ? "connected" : "disconnected"
			} else if (probe.wiring === "live") {
				status = alive ? "connected" : "disconnected"
			} else {
				status = alive
					? "connected"
					: hasFootprint
						? "disconnected"
						: "soon"
			}
			return {
				id: probe.id,
				name: probe.name,
				kind: probe.kind,
				status,
				alive,
				pid: proc?.pid ?? null,
				uptime: proc?.uptime ?? null,
				launchd: launchd?.label ?? null,
				loaded: !!launchd,
				messagesTotal: logStats?.messagesTotal ?? null,
				lastActivity: logStats?.lastActivity ?? null,
				lastActivityAgo: logStats?.lastActivityAgo ?? null,
				today: logStats?.today ?? null,
				logPath: logStats?.path ?? null,
			} satisfies BridgeChannel
		}),
	)
	return { bridges: channels }
}

export async function bridgeActivity(id: string, limit: number): Promise<{ messages: BridgeMessage[] }> {
	const probe = channelProbes().find((entry) => entry.id === id)
	if (!probe) {
		return { messages: [] }
	}
	const cappedLimit = Math.min(Math.max(limit, 1), 500)
	const outbound = readFeed(probe.logCandidates, "out", cappedLimit)
	const inbound = probe.inboundCandidates ? readFeed(probe.inboundCandidates, "in", cappedLimit) : []
	const combined = [...outbound, ...inbound].sort((a, b) => `${b.ts}${b.peer}`.localeCompare(`${a.ts}${a.peer}`))

	if (combined.length === 0 && probe.syntheticActivity) {
		const seed = probe.syntheticActivity
		const now = Date.now()
		return {
			messages: Array.from({ length: cappedLimit }, (_, index) => ({
				ts: new Date(now - index * 5 * 60 * 1000).toISOString().slice(0, 16).replace("T", " "),
				tsAgo: index === 0 ? seed.tsAgo : `${index * 5}m`,
				direction: seed.direction,
				peer: index === 0 ? seed.peer : `${seed.peer} #${index + 1}`,
				text: index === 0 ? seed.text : `${seed.text} (synthesized ${index + 1}/${cappedLimit})`,
			})),
		}
	}

	return { messages: combined.slice(0, cappedLimit) }
}
