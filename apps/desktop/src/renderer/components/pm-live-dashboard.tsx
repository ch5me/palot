import { Button } from "@ch5me/elf-ui/components/button"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import { RefreshCwIcon } from "lucide-react"
import { useMemo } from "react"
import type {
	Ch5PmAttentionQueue,
	Ch5PmBabysitter,
	Ch5PmLiveBackgroundAgent,
	Ch5PmLiveBox,
	Ch5PmLiveLane,
	Ch5PmLiveState,
	Ch5PmFollowUp,
	Ch5PmLineageItem,
	Ch5PmNeedsChrisItem,
} from "../ch5pm-dashboard/types"
import {
	classifyLaneStatus,
	composePmSideAgentsModel,
	type Ch5PmDenseConsoleViewModel,
	type Ch5PmLaneStatus,
} from "../pm-side-agents/composition"
import { createLogger } from "../lib/logger"
import { fetchCh5PmState, openExternalUrl } from "../services/backend"
import { PmAttentionQueue } from "./pm-attention-queue"

const log = createLogger("pm-live-dashboard")

const POLL_MS = 15_000

const BOX_COLS = "52px minmax(0,0.8fr) minmax(0,1.2fr) 20px"
const NEEDS_COLS = "72px minmax(0,1fr) 48px 52px"
const FOLLOWUP_COLS = "64px minmax(0,1fr) 68px 82px"
const FRONTIER_COLS = "72px minmax(0,1fr) 68px 52px"
const AGENT_COLS = "minmax(0,1fr) 72px minmax(0,0.9fr)"
const COMPLETE_COLS = "18px minmax(0,1fr)"
const SESSION_COLS = "52px minmax(0,1.8fr) minmax(0,1fr) 54px 68px minmax(0,1.2fr)"

const GLYPH: Record<string, string> = {
	working: "▶",
	done: "◼",
	nudged: "→",
	idle: "◇",
	"needs-chris": "✗",
}

const ROLE_GLYPH: Record<string, string> = {
	planning: "⚑",
	implementation: "▶",
	review: "★",
	manual: "●",
}

const ROLE_COLOR: Record<string, string> = {
	planning: "text-amber-400",
	implementation: "text-sky-400",
	review: "text-fuchsia-400",
	manual: "text-neutral-400",
}

const STATUS_COLOR: Record<string, string> = {
	done: "text-emerald-400",
	running: "text-sky-400",
	blocked: "text-red-400",
	pending: "text-neutral-500",
}

function laneStatus(status?: string): Ch5PmLaneStatus {
	return classifyLaneStatus(status)
}

function fmtAge(value?: string): string {
	if (!value) return "--"
	const ts = Date.parse(value)
	if (Number.isNaN(ts)) return value
	const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
	if (sec < 60) return `${sec}s`
	const min = Math.floor(sec / 60)
	if (min < 60) return `${min}m`
	const hr = Math.floor(min / 60)
	if (hr < 48) return `${hr}h`
	return `${Math.floor(hr / 24)}d`
}

function asText(value: unknown): string {
	if (value == null) return ""
	if (typeof value === "string") return value
	if (typeof value === "number" || typeof value === "boolean") return String(value)
	if (Array.isArray(value)) return value.map(asText).filter(Boolean).join(" ")
	if (typeof value === "object") {
		return Object.entries(value as Record<string, unknown>)
			.map(([k, v]) => `${k}:${asText(v)}`)
			.join(" ")
	}
	return String(value)
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {}
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : []
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = record[key]
		if (typeof value === "string" && value.trim().length > 0) return value
		if (typeof value === "number" || typeof value === "boolean") return String(value)
	}
	return undefined
}

function readNumber(record: Record<string, unknown>, key: string): number {
	const value = record[key]
	return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function directorySlug(value?: string): string | undefined {
	if (!value) return undefined
	return value.replace(/^~\/src\/ch5\//, "").split("/").filter(Boolean).pop()
}

function normalizeBoxes(value: unknown): Ch5PmLiveBox[] {
	return asArray(value).map((item) => {
		const box = asRecord(item)
		const daemon = asRecord(box.daemon)
		const metadata = asRecord(box.metadata)
		const staticBox = asRecord(metadata.staticBox)
		const fleet = asRecord(box.fleet)
		const provider = asRecord(fleet.provider)
		const transport = asRecord(fleet.workerLaunchTransport)
		const healthy = typeof box.healthy === "boolean"
			? box.healthy
			: readString(daemon, "health") === "healthy"
		return {
			id: readString(box, "id", "boxId") ?? "unknown-box",
			role:
				readString(box, "role") ??
				readString(staticBox, "role") ??
				readString(provider, "kind") ??
				"box",
			daemon: {
				url: readString(daemon, "url", "altUrl") ?? readString(transport, "daemonBaseUrl"),
				altUrl: readString(daemon, "altUrl"),
				health: readString(daemon, "health") ?? (healthy ? "healthy" : "degraded"),
				boundHost: readString(daemon, "boundHost"),
			},
			opencodeServe: readString(box, "opencodeServe"),
			notes: readString(box, "notes") ?? asText(metadata.degradedReasons),
		}
	})
}

function normalizeSessions(
	value: unknown,
): ReturnType<typeof composePmSideAgentsModel>["denseConsole"]["sessions"] {
	return asArray(value).map((item) => {
		const session = asRecord(item)
		const directory = readString(session, "directory")
		const repo = readString(session, "repo", "repoId") ?? directorySlug(directory)
		const id = readString(session, "id", "sessionId") ?? readString(session, "title") ?? "unknown-session"
		return {
			id,
			title: readString(session, "title") ?? id,
			repo,
			box: readString(session, "box", "boxId", "sourceBoxId"),
			state: readString(session, "state", "status", "classification"),
			lane: readString(session, "lane", "reason", "recommendation"),
			projectSlug: readString(session, "projectSlug") ?? repo,
		}
	})
}

function normalizeNeedsChris(value: unknown): Ch5PmNeedsChrisItem[] {
	return asArray(value).map((item) => {
		if (typeof item === "string") return { title: item, source: "daemon" }
		const row = asRecord(item)
		return {
			ticket: readString(row, "ticket", "ticketId"),
			title: readString(row, "title", "name"),
			note: readString(row, "note", "reason"),
			source: readString(row, "source", "sourceBoxId", "boxId"),
			priority: readString(row, "priority"),
		}
	})
}

function normalizePlane(value: unknown): ReturnType<typeof composePmSideAgentsModel>["denseConsole"]["plane"] {
	const plane = asRecord(value)
	return {
		workspaceSlug: readString(plane, "workspaceSlug"),
		projects: typeof plane.projects === "number" ? plane.projects : undefined,
		epics: typeof plane.epics === "number" ? plane.epics : undefined,
		readUrl: readString(plane, "readUrl"),
		readyFrontier: asArray(plane.readyFrontier).map((item) => {
			const ticket = asRecord(item)
			return {
				ticket: readString(ticket, "ticket", "ticketId", "id") ?? "ticket",
				title: readString(ticket, "title", "name") ?? "Untitled",
				priority: readString(ticket, "priority"),
				repo: readString(ticket, "repo", "repoId"),
				coveredBy: readString(ticket, "coveredBy") ?? null,
			}
		}),
		humanGated: asRecord(plane.humanGated),
	}
}

function normalizeAttentionQueue(value: unknown): Ch5PmAttentionQueue | undefined {
	const queue = asRecord(value)
	const counts = asRecord(queue.counts)
	const open = asArray(queue.open) as Ch5PmAttentionQueue["open"]
	if (open.length === 0 && Object.keys(counts).length === 0) return undefined
	return {
		open,
		counts: {
			total: readNumber(counts, "total"),
			p0: readNumber(counts, "p0"),
			p1: readNumber(counts, "p1"),
			p2: readNumber(counts, "p2"),
		},
	}
}

function normalizeLiveState(data?: Ch5PmLiveState | null): Ch5PmLiveState {
	const raw = asRecord(data)
	const schemaVersion = typeof raw.schemaVersion === "number"
		? raw.schemaVersion
		: Number(readString(raw, "schemaVersion"))
	return {
		_doc: readString(raw, "_doc"),
		schemaVersion: Number.isFinite(schemaVersion) ? schemaVersion : undefined,
		updatedAt: readString(raw, "updatedAt"),
		generatedBy: readString(raw, "generatedBy"),
		host: readString(raw, "host"),
		boxes: normalizeBoxes(raw.boxes),
		sessions: normalizeSessions(raw.sessions),
		lanes: asArray(raw.lanes) as Ch5PmLiveLane[],
		backgroundAgents: asArray(raw.backgroundAgents) as Ch5PmLiveBackgroundAgent[],
		plane: normalizePlane(raw.plane ?? raw.planeSummary),
		recentCompletions: asArray(raw.recentCompletions).map(asText).filter(Boolean),
		needsChris: normalizeNeedsChris(raw.needsChris),
		followUps: asArray(raw.followUps) as Ch5PmFollowUp[],
		babysitter: asRecord(raw.babysitter) as Ch5PmBabysitter,
		lineage: asArray(raw.lineage) as Ch5PmLineageItem[],
		attentionQueue: normalizeAttentionQueue(raw.attentionQueue),
	}
}

function openUrl(url?: string) {
	if (!url) return
	void openExternalUrl(url).catch((err) => log.warn("open url failed", { url, err }))
}

function H({ children, className }: { children?: React.ReactNode; className?: string }) {
	return <div className={`truncate px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400 ${className ?? ""}`}>{children}</div>
}

function C({ children, className }: { children?: React.ReactNode; className?: string }) {
	return <div className={`truncate px-1.5 py-0.5 text-[10px] leading-3 ${className ?? ""}`}>{children}</div>
}

function FreshBadge({ freshness }: { freshness: Ch5PmDenseConsoleViewModel["freshness"]["pmState"] }) {
	if (freshness === "fresh") return null
	const tone = freshness === "stale"
		? "border-amber-500/30 text-amber-500"
		: "border-red-500/30 text-red-400"
	return <span className={`rounded border px-1 py-px text-[8px] uppercase tracking-[0.14em] ${tone}`}>{freshness}</span>
}

function SecRow({
	label,
	meta,
	freshness,
}: {
	label: string
	meta?: string
	freshness?: Ch5PmDenseConsoleViewModel["freshness"]["pmState"]
}) {
	return (
		<div className="flex h-5 items-center justify-between border-b border-neutral-300 bg-neutral-100 px-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
			<div className="flex min-w-0 items-center gap-1.5">
				<span>{label}</span>
				{freshness ? <FreshBadge freshness={freshness} /> : null}
			</div>
			{meta ? <span className="truncate font-normal tracking-[0.1em]">{meta}</span> : null}
		</div>
	)
}

function StatPill({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
	return (
		<div className="flex items-center gap-1 border-l border-neutral-300 px-2 py-0.5 text-[10px] dark:border-neutral-700 first:border-l-0">
			<span className="text-[9px] uppercase tracking-[0.16em] text-neutral-500 dark:text-neutral-400">{label}</span>
			<span className={`font-medium ${tone ?? "text-neutral-900 dark:text-neutral-100"}`}>{value}</span>
		</div>
	)
}

function BoxRow({ box }: { box: Ch5PmLiveBox }) {
	const healthy = box.daemon.health === "healthy"
	return (
		<div className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700" style={{ gridTemplateColumns: BOX_COLS }}>
			<C className={healthy ? "text-emerald-400" : "text-red-400"}>{box.id}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{box.role ?? "box"}</C>
			<C className="text-neutral-400 dark:text-neutral-500">{asText(box.opencodeServe ?? box.daemon.url)}</C>
			<C className="px-0 text-center">
				<button type="button" onClick={() => openUrl(box.daemon.url)} className="text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">→</button>
			</C>
		</div>
	)
}

function SessionRow({
	session,
	lane,
}: {
	session: ReturnType<typeof composePmSideAgentsModel>["denseConsole"]["sessions"][number]
	lane?: Ch5PmLiveLane
}) {
	const router = useRouter()
	const status = laneStatus(lane?.status ?? session.state)
	const clickable = Boolean(session.projectSlug)

	function navigate() {
		if (!session.projectSlug) return
		void router.navigate({
			to: "/project/$projectSlug/session/$sessionId",
			params: { projectSlug: session.projectSlug, sessionId: session.id },
		})
	}

	const colorClass = status === "working"
		? "text-emerald-400"
		: status === "needs-chris"
			? "text-red-400"
			: status === "done"
				? "text-sky-400"
				: "text-neutral-600 dark:text-neutral-400"

	return (
		<div className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700" style={{ gridTemplateColumns: SESSION_COLS }}>
			<C className={`font-medium ${colorClass}`}>{GLYPH[status]}</C>
			<C>
				<button type="button" onClick={navigate} disabled={!clickable} className={`block w-full truncate text-left ${clickable ? "text-neutral-900 dark:text-neutral-100 hover:text-amber-500" : "cursor-default text-neutral-500 dark:text-neutral-500"}`}>
					{asText(session.title)}
				</button>
			</C>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(session.repo) || "--"}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(session.box) || "--"}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(lane?.status ?? session.state) || "--"}</C>
			<C className="text-neutral-400 dark:text-neutral-500">{asText(lane?.goal ?? session.lane)}</C>
		</div>
	)
}

function NeedsRow({ item }: { item: Ch5PmNeedsChrisItem }) {
	return (
		<div className="grid border-b border-red-900/30 last:border-b-0" style={{ gridTemplateColumns: NEEDS_COLS }}>
			<C className="text-red-400">{asText(item.ticket) || "manual"}</C>
			<C className="text-neutral-900 dark:text-neutral-100">{asText(item.title ?? item.note) || "attention"}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(item.priority) || "--"}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(item.source) || "--"}</C>
		</div>
	)
}

function FollowUpRow({ item }: { item: Ch5PmFollowUp }) {
	const status = asText(item.status) || "open"
	const statusColor = status === "done" ? "text-emerald-400" : status === "dispatched" ? "text-amber-400" : "text-red-400"
	return (
		<div className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700" style={{ gridTemplateColumns: FOLLOWUP_COLS }}>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(item.source) || "--"}</C>
			<C className="text-neutral-900 dark:text-neutral-100">{asText(item.item)}</C>
			<C className={`font-medium ${statusColor}`}>{status}</C>
			<C className="text-neutral-400 dark:text-neutral-500">{asText(item.resolution)}</C>
		</div>
	)
}

function FrontierRow({
	ticket,
}: {
	ticket: ReturnType<typeof composePmSideAgentsModel>["denseConsole"]["plane"]["readyFrontier"][number]
}) {
	return (
		<div className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700" style={{ gridTemplateColumns: FRONTIER_COLS }}>
			<C className="text-sky-400">{asText(ticket.ticket)}</C>
			<C className="text-neutral-900 dark:text-neutral-100">{asText(ticket.title)}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(ticket.repo) || "--"}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(ticket.priority) || "--"}</C>
		</div>
	)
}

function AgentRow({ agent }: { agent: Ch5PmLiveBackgroundAgent }) {
	const ms = Object.entries(agent.milestones ?? {}).slice(0, 2).map(([k, v]) => `${k}:${v}`).join(" ")
	return (
		<div className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700" style={{ gridTemplateColumns: AGENT_COLS }}>
			<C className="text-neutral-900 dark:text-neutral-100">{asText(agent.task)}</C>
			<C className="text-neutral-500 dark:text-neutral-400">{asText(agent.status) || "--"}</C>
			<C className="text-neutral-400 dark:text-neutral-500">{ms || "--"}</C>
		</div>
	)
}

function CompleteRow({ item }: { item: string }) {
	return (
		<div className="grid border-b border-neutral-200 last:border-b-0 dark:border-neutral-700" style={{ gridTemplateColumns: COMPLETE_COLS }}>
			<C className="px-1.5 text-center text-emerald-500">✓</C>
			<C className="text-neutral-600 dark:text-neutral-400">{asText(item)}</C>
		</div>
	)
}

function Empty({ label }: { label: string }) {
	return <div className="px-1.5 py-1 text-[10px] text-neutral-400 dark:text-neutral-500">{label}</div>
}

function LineageChain({ item }: { item: Ch5PmLineageItem }) {
	const router = useRouter()

	return (
		<div className="grid border-b border-neutral-200 px-2 py-1 last:border-b-0 dark:border-neutral-700">
			<div className="flex items-center gap-1">
				<C className="min-w-0 shrink-0 px-0 text-[10px] font-bold text-sky-400">{asText(item.ticket)}</C>
				{item.kind ? <C className="min-w-0 shrink-0 px-0 text-[9px] uppercase tracking-[0.1em] text-neutral-500">{asText(item.kind)}</C> : null}
				<C className="min-w-0 px-0 text-[10px] text-neutral-600 dark:text-neutral-400">{asText(item.title)}</C>
			</div>
			<div className="mt-1 flex flex-wrap items-center gap-1 pl-3 text-[9px]">
				{item.sessions.map((session, idx) => {
					const edge = item.edges.find((e) => e.from === session.id)
					function navigate() {
						if (!session.projectSlug) return
						void router.navigate({ to: "/project/$projectSlug/session/$sessionId", params: { projectSlug: session.projectSlug, sessionId: session.id } })
					}
					const role = asText(session.role)
					const status = asText(session.status)
					const label = role === "planning"
						? asText(session.output) || asText(session.agent) || session.id.slice(0, 6)
						: asText(session.agent) || session.id.slice(0, 6)
					return (
						<div key={session.id} className="flex items-center gap-1">
							{idx > 0 ? <span className="text-neutral-500">→</span> : null}
							<button type="button" onClick={navigate} className={`flex items-center gap-1 ${ROLE_COLOR[role] ?? "text-neutral-400"}`}>
								<span>{ROLE_GLYPH[role] ?? "●"}</span>
								<span className="max-w-[120px] truncate">{label}</span>
								{status ? <span className={`${STATUS_COLOR[status] ?? "text-neutral-500"}`}>{status}</span> : null}
							</button>
							{edge ? <span className="max-w-[140px] truncate text-neutral-500">{asText(edge.kind)}</span> : null}
						</div>
					)
				})}
				{item.plan ? <span className="truncate text-neutral-500">plan:{asText(item.plan).split("/").slice(-1)[0]}</span> : null}
			</div>
		</div>
	)
}

export function PmLiveDashboard() {
	const query = useQuery({
		queryKey: ["pm-live-dashboard"],
		queryFn: fetchCh5PmState,
		refetchInterval: POLL_MS,
		staleTime: 10_000,
	})

	const normalizedState = normalizeLiveState(query.data)
	const dense = useMemo(
		() => composePmSideAgentsModel({ pmState: normalizedState }).denseConsole,
		[normalizedState],
	)
	const state: Ch5PmDenseConsoleViewModel = dense

	const lanesBySession = useMemo(() => {
		const map = new Map<string, Ch5PmLiveLane>()
		for (const lane of state.lanes) {
			if (lane.session) map.set(lane.session, lane)
		}
		return map
	}, [state.lanes])

	const workingCount = state.counts.working
	const needsCount = state.needsChris.length || (state.plane.humanGated?.count ?? 0)
	const askCount = state.counts.attention
	const readyCount = state.counts.ready
	const errMsg = query.error instanceof Error ? query.error.message : query.error ? "load failed" : null

	const sessions = state.sessions.slice(0, 14)
	const boxes = state.boxes.slice(0, 6)
	const agents = state.backgroundAgents.slice(0, 5)
	const completes = state.recentCompletions.slice(0, 5)
	const needs = state.needsChris.slice(0, 7)
	const followups = (state.followUps ?? []).slice(0, 8)
	const frontier = state.plane.readyFrontier.slice(0, 7)
	const planeUrl = state.links.plane

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-white font-mono text-[10px] dark:bg-neutral-950 dark:text-neutral-200">
			<div className="flex h-7 items-center border-b border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900">
				<div className="flex h-full items-center border-r border-neutral-300 px-2 text-[10px] font-bold tracking-widest text-neutral-900 dark:border-neutral-700 dark:text-neutral-100">
					CH5PM
				</div>
			{state.babysitter ? (
				<div className="flex h-full items-center border-r border-neutral-300 px-2 text-[9px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
					<span className={`mr-1.5 font-bold ${state.babysitter.running ? "text-emerald-500" : "text-red-400"}`}>{state.babysitter.running ? "●" : "○"}</span>
					<span className="truncate">{asText(state.babysitter.surface)}</span>
					<span className="mx-1 text-neutral-300 dark:text-neutral-600">/</span>
					<span className="truncate">{asText(state.babysitter.package)}</span>
					<span className="ml-2 text-neutral-400">{asText(state.babysitter.loopSeconds)}s</span>
				</div>
			) : null}
			<StatPill label="updated" value={fmtAge(normalizedState.updatedAt)} />
			<StatPill label="host" value={asText(normalizedState.host) || "--"} />
			<StatPill label="boxes" value={state.counts.boxes} />
			<StatPill label="sessions" value={state.counts.sessions} />
			<StatPill label="work" value={workingCount} tone="text-emerald-400" />
			<StatPill label="ready" value={readyCount} tone="text-sky-400" />
			<StatPill label="needs" value={needsCount} tone={needsCount > 0 ? "text-red-400" : undefined} />
			<StatPill label="ask" value={askCount} tone={askCount > 0 ? "text-red-400" : undefined} />
			<StatPill label="schema" value={normalizedState.schemaVersion ?? "?"} />
			<StatPill label="followups" value={state.counts.followUps} />

				<div className="ml-auto flex h-full items-center border-l border-neutral-300 px-1.5 dark:border-neutral-700">
					<Button variant="ghost" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching} className="h-5 rounded-none border-0 px-1.5 text-[9px] uppercase tracking-[0.16em] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
						<RefreshCwIcon className={`mr-1 size-2.5 ${query.isFetching ? "animate-spin" : ""}`} />
						sync
					</Button>
				</div>
			</div>

			<PmAttentionQueue queue={state.attentionQueue ?? undefined} onMutated={() => void query.refetch()} />

			{state.lineage.length > 0 ? (
				<div className="flex min-h-0 flex-col border-b border-neutral-300 dark:border-neutral-700">
					<div className="flex h-5 items-center justify-between border-b border-neutral-300 bg-neutral-100 px-2 text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
						<span>lineage</span>
						<span>{state.lineage.length} chain{state.lineage.length !== 1 ? "s" : ""}</span>
					</div>
					<div className="min-h-0 overflow-hidden">
						{state.lineage.slice(0, 3).map((item) => <LineageChain key={item.ticket} item={item} />)}
					</div>
				</div>
			) : null}

			{errMsg ? (
				<div className="flex h-5 items-center border-b border-amber-600/30 bg-amber-950/30 px-2 text-[9px] uppercase tracking-[0.16em] text-amber-400">⚠ {errMsg}</div>
			) : null}

			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)_minmax(280px,0.75fr)]">
				<div className="grid min-h-0 grid-rows-[1fr_128px] border-r border-neutral-300 dark:border-neutral-700">
					<div className="min-h-0">
						<SecRow label="sessions" meta={`${state.counts.sessions} live`} freshness={state.freshness.pmState} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: SESSION_COLS }}>
							<H>st</H><H>session</H><H>repo</H><H>box</H><H>lane</H><H>goal</H>
						</div>
						<div className="min-h-0 overflow-hidden">
							{sessions.length > 0 ? sessions.map((session) => <SessionRow key={session.id} session={session} lane={lanesBySession.get(session.id)} />) : <Empty label="no live sessions" />}
						</div>
					</div>
					<div className="grid min-h-0 grid-rows-[1fr_1fr] border-t border-neutral-300 dark:border-neutral-700">
						<div className="min-h-0 border-b border-neutral-200 dark:border-neutral-700">
							<SecRow label="agents" meta={`${state.counts.backgroundAgents}`} />
							<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: AGENT_COLS }}>
								<H>task</H><H>status</H><H>milestones</H>
							</div>
							<div className="min-h-0 overflow-hidden">
								{agents.length > 0 ? agents.map((agent, index) => <AgentRow key={`${agent.task}-${index}`} agent={agent} />) : <Empty label="no agents" />}
							</div>
						</div>
						<div className="min-h-0">
							<SecRow label="completions" meta={`${state.counts.recentCompletions}`} />
							<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: COMPLETE_COLS }}>
								<H /><H>item</H>
							</div>
							<div className="min-h-0 overflow-hidden">
								{completes.length > 0 ? completes.map((item, index) => <CompleteRow key={`${item}-${index}`} item={item} />) : <Empty label="no completions" />}
							</div>
						</div>
					</div>
				</div>

				<div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] border-r border-neutral-300 dark:border-neutral-700">
					<div className="min-h-0 border-b border-neutral-200 dark:border-neutral-700">
						<SecRow label="needs chris" meta={needsCount > 0 ? `${needsCount}` : undefined} freshness={needs.length > 0 ? undefined : state.freshness.pmState} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: NEEDS_COLS }}>
							<H>ticket</H><H>title</H><H>prio</H><H>src</H>
						</div>
						<div className="min-h-0 overflow-hidden bg-red-950/10 dark:bg-red-950/20">
							{needs.length > 0 ? needs.map((item, index) => <NeedsRow key={`${asText(item.ticket ?? item.title)}-${index}`} item={item} />) : <Empty label={needsCount > 0 ? `${needsCount} human-gated` : "clear"} />}
						</div>
					</div>
					<div className="min-h-0">
						<SecRow label="ready frontier" meta={`${state.plane.projects ?? 0}p ${state.plane.epics ?? 0}e`} freshness={frontier.length > 0 ? undefined : state.freshness.pmState} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: FRONTIER_COLS }}>
							<H>ticket</H><H>title</H><H>repo</H><H>prio</H>
						</div>
						<div className="min-h-0 overflow-hidden">
							{frontier.length > 0 ? frontier.map((ticket) => <FrontierRow key={ticket.ticket} ticket={ticket} />) : <Empty label="no ready frontier" />}
						</div>
					</div>
				</div>

				<div className="grid min-h-0 grid-rows-[minmax(0,1fr)_144px]">
					<div className="min-h-0 border-b border-neutral-200 dark:border-neutral-700">
						<SecRow label="followups" meta={`${state.counts.followUps}`} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: FOLLOWUP_COLS }}>
							<H>src</H><H>item</H><H>status</H><H>resolution</H>
						</div>
						<div className="min-h-0 overflow-hidden">
							{followups.length > 0 ? followups.map((item, index) => <FollowUpRow key={`${asText(item.source)}-${index}`} item={item} />) : <Empty label="no followups" />}
						</div>
					</div>
					<div className="min-h-0">
						<SecRow label="boxes" meta={`${state.counts.boxes}`} />
						<div className="grid border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900" style={{ gridTemplateColumns: BOX_COLS }}>
							<H>id</H><H>role</H><H>serve</H><H />
						</div>
						<div className="min-h-0 overflow-hidden">
							{boxes.length > 0 ? boxes.map((box) => <BoxRow key={box.id} box={box} />) : <Empty label="no boxes" />}
						</div>
					</div>
				</div>
			</div>

			<div className="flex h-4 items-center justify-between border-t border-neutral-300 bg-neutral-50 px-2 text-[9px] text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
				<span className="truncate">{planeUrl ? <button type="button" onClick={() => openUrl(planeUrl)} className="truncate hover:text-neutral-700 dark:hover:text-neutral-300">ch5pm daemon /pm/state via firefly</button> : "ch5pm daemon /pm/state via firefly"}</span>
				<span className="truncate">{asText(normalizedState.generatedBy) || state.sources.label || "--"}</span>
			</div>
		</div>
	)
}
