import { Badge } from "@ch5me/elf-ui/components/badge"
import { Button } from "@ch5me/elf-ui/components/button"
import { useQuery } from "@tanstack/react-query"
import {
	ActivityIcon,
	ArrowUpRightIcon,
	CheckCircle2Icon,
	CircleAlertIcon,
	RefreshCwIcon,
	ServerIcon,
	TicketIcon,
	UserRoundIcon,
	WorkflowIcon,
} from "lucide-react"
import { useRouter } from "@tanstack/react-router"
import { useMemo } from "react"
import type {
	Ch5PmLiveBackgroundAgent,
	Ch5PmLiveBox,
	Ch5PmLiveLane,
	Ch5PmLivePlaneSummary,
	Ch5PmLiveSession,
	Ch5PmLiveState,
	Ch5PmNeedsChrisItem,
} from "../ch5pm-dashboard/types"
import { createLogger } from "../lib/logger"
import { fetchCh5PmState, openExternalUrl } from "../services/backend"

const log = createLogger("pm-live-dashboard")

const POLL_MS = 15_000

const YOLO_TONES: Record<string, string> = {
	working: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	done: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
	idle: "border-border/70 bg-muted/40 text-muted-foreground",
	nudged: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
	"needs-chris": "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
}

function normalizeLaneStatus(status?: string): keyof typeof YOLO_TONES {
	const normalized = status?.trim().toLowerCase() ?? "idle"
	if (normalized.includes("need") || normalized.includes("human")) return "needs-chris"
	if (normalized.includes("nudge")) return "nudged"
	if (normalized.includes("done") || normalized.includes("claim")) return "done"
	if (normalized.includes("work") || normalized.includes("busy") || normalized.includes("run")) return "working"
	return "idle"
}

function formatTimeAgo(value?: string): string {
	if (!value) return "--"
	const timestamp = Date.parse(value)
	if (Number.isNaN(timestamp)) return value
	const deltaSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
	if (deltaSeconds < 60) return `${deltaSeconds}s ago`
	const deltaMinutes = Math.floor(deltaSeconds / 60)
	if (deltaMinutes < 60) return `${deltaMinutes}m ago`
	const deltaHours = Math.floor(deltaMinutes / 60)
	if (deltaHours < 48) return `${deltaHours}h ago`
	const deltaDays = Math.floor(deltaHours / 24)
	return `${deltaDays}d ago`
}

function openUrl(url?: string) {
	if (!url) return
	void openExternalUrl(url).catch((error) => {
		log.warn("failed to open external url", { url, error })
	})
}

function StatCard({
	label,
	value,
	caption,
	icon: Icon,
	tone,
}: {
	label: string
	value: number | string
	caption: string
	icon: typeof ActivityIcon
	tone?: string
}) {
	return (
		<div className="rounded-3xl border border-border/60 bg-card/75 p-4 shadow-sm backdrop-blur-sm">
			<div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
				<Icon className="size-3.5" />
				{label}
			</div>
			<div className={`mt-3 text-3xl font-semibold ${tone ?? "text-foreground"}`}>{value}</div>
			<div className="mt-1 text-xs text-muted-foreground">{caption}</div>
		</div>
	)
}

function Section({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
	return (
		<section className="rounded-[28px] border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-sm">
			<div className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">{eyebrow}</div>
			<h2 className="mt-2 text-lg font-semibold text-foreground">{title}</h2>
			<div className="mt-4">{children}</div>
		</section>
	)
}

function BoxCard({ box }: { box: Ch5PmLiveBox }) {
	const healthy = box.daemon.health === "healthy"
	return (
		<div className="rounded-3xl border border-border/60 bg-background/80 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="flex items-center gap-2">
						<div className="text-base font-semibold text-foreground">{box.id}</div>
						<Badge variant={healthy ? "secondary" : "destructive"}>{box.daemon.health ?? "unknown"}</Badge>
					</div>
					<div className="mt-1 text-sm text-muted-foreground">{box.role ?? "box"}</div>
				</div>
				<Button variant="ghost" size="icon-sm" onClick={() => openUrl(box.daemon.url)}>
					<ArrowUpRightIcon className="size-4" />
				</Button>
			</div>
			<div className="mt-4 grid gap-2 text-xs text-muted-foreground">
				<div className="rounded-2xl border border-border/50 bg-muted/30 px-3 py-2">
					<div className="font-medium text-foreground">Daemon</div>
					<div className="mt-1 break-all">{box.daemon.url ?? "--"}</div>
					{box.daemon.altUrl ? <div className="mt-1 break-all">alt {box.daemon.altUrl}</div> : null}
				</div>
				<div className="rounded-2xl border border-border/50 bg-muted/30 px-3 py-2">
					<div className="font-medium text-foreground">OpenCode serve</div>
					<div className="mt-1 break-all">{box.opencodeServe ?? "--"}</div>
				</div>
				{box.notes ? <div className="text-xs leading-5 text-muted-foreground">{box.notes}</div> : null}
			</div>
		</div>
	)
}

function SessionRow({ session, lane }: { session: Ch5PmLiveSession; lane?: Ch5PmLiveLane }) {
	const router = useRouter()
	const laneStatus = normalizeLaneStatus(lane?.status ?? session.state)

	function handleSessionClick() {
		if (!session.projectSlug) return
		void router.navigate({
			to: "/project/$projectSlug/session/$sessionId",
			params: { projectSlug: session.projectSlug, sessionId: session.id },
		})
	}

	const clickable = Boolean(session.projectSlug)

	return (
		<div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm">
			<div className="min-w-0">
				<button
					type="button"
					onClick={handleSessionClick}
					disabled={!clickable}
					className={`w-full text-left font-medium text-foreground transition-colors ${clickable ? "cursor-pointer hover:text-primary" : "cursor-default opacity-60"}`}
				>
					{session.title}
				</button>
				<div className="mt-1 text-xs text-muted-foreground">{session.id}</div>
			</div>
			<div className="min-w-0">
				<div className="truncate text-foreground">{session.repo ?? "--"}</div>
				<div className="mt-1 text-xs text-muted-foreground">{session.box ?? "--"}</div>
			</div>
			<div className="min-w-0">
				<div className="truncate text-foreground">{session.lane ?? lane?.name ?? "--"}</div>
				<div className="mt-1 text-xs text-muted-foreground">{lane?.goal ?? ""}</div>
			</div>
			<div className="flex items-center justify-between gap-2">
				<Badge className={YOLO_TONES[laneStatus]} variant="outline">
					{lane?.symbol ? `${lane.symbol} ` : ""}
					{lane?.status ?? session.state ?? "unknown"}
				</Badge>
			</div>
		</div>
	)
}

function NeedsChrisCard({ item }: { item: Ch5PmNeedsChrisItem }) {
	return (
		<div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 shadow-sm">
			<div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
				<UserRoundIcon className="size-4" />
				{item.ticket ?? item.title ?? "Needs Chris"}
			</div>
			{item.title && item.ticket ? <div className="mt-2 text-sm text-foreground">{item.title}</div> : null}
			{item.note ? <div className="mt-2 text-sm leading-6 text-muted-foreground">{item.note}</div> : null}
			<div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
				{item.priority ? <Badge variant="outline">{item.priority}</Badge> : null}
				{item.source ? <Badge variant="outline">{item.source}</Badge> : null}
			</div>
		</div>
	)
}

function BackgroundAgentCard({ agent }: { agent: Ch5PmLiveBackgroundAgent }) {
	const milestones = Object.entries(agent.milestones ?? {})
	return (
		<div className="rounded-3xl border border-border/60 bg-background/80 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="font-medium text-foreground">{agent.task}</div>
					<div className="mt-1 text-sm text-muted-foreground">{agent.status ?? "unknown"}</div>
				</div>
				<Badge variant="outline">agent</Badge>
			</div>
			{milestones.length > 0 ? (
				<div className="mt-4 grid gap-2 sm:grid-cols-2">
					{milestones.map(([label, value]) => (
						<div key={label} className="rounded-2xl border border-border/50 bg-muted/30 px-3 py-2 text-xs">
							<div className="font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
							<div className="mt-1 text-foreground">{value}</div>
						</div>
					))}
				</div>
			) : null}
		</div>
	)
}

function FrontierRow({ ticket }: { ticket: Ch5PmLivePlaneSummary["readyFrontier"][number] }) {
	return (
		<div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="font-medium text-foreground">{ticket.ticket}</div>
					<div className="mt-1 text-sm text-foreground">{ticket.title}</div>
					<div className="mt-1 text-xs text-muted-foreground">
						{[ticket.repo, ticket.coveredBy ? `covered by ${ticket.coveredBy}` : "uncovered"]
							.filter(Boolean)
							.join(" · ")}
					</div>
				</div>
				{ticket.priority ? <Badge variant="outline">{ticket.priority}</Badge> : null}
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

	const data = query.data
	const lanesBySession = useMemo(() => {
		const map = new Map<string, Ch5PmLiveLane>()
		for (const lane of data?.lanes ?? []) {
			if (lane.session) map.set(lane.session, lane)
		}
		return map
	}, [data?.lanes])

	const workingCount = (data?.lanes ?? []).filter((lane) => normalizeLaneStatus(lane.status) === "working").length
	const needsChrisCount = data?.needsChris.length ?? 0
	const readyCount = data?.plane.readyFrontier.length ?? 0
	const humanGatedCount = data?.plane.humanGated?.count ?? 0

	const emptyState: Ch5PmLiveState = {
		boxes: [],
		sessions: [],
		lanes: [],
		backgroundAgents: [],
		plane: { readyFrontier: [] },
		recentCompletions: [],
		needsChris: [],
	}

	const state = data ?? emptyState

	return (
		<div className="grid gap-6">
			<div className="relative overflow-hidden rounded-[32px] border border-border/60 bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.22),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-6 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.2),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.2),_transparent_24%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(17,24,39,0.92))]">
				<div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<div className="text-[11px] font-medium uppercase tracking-[0.28em] text-muted-foreground">CH5PM live watchdog</div>
						<h1 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
							Real-time PM state across boxes, sessions, lanes, and Plane.
						</h1>
						<p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
							This page reads the curated PM feed now and is ready to swap to daemon HTTP later.
							 Chris should only have to look here to know whether the mesh is working or needs a decision.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<Badge variant="outline">schema v{state.schemaVersion ?? "?"}</Badge>
						<Badge variant="outline">updated {formatTimeAgo(state.updatedAt)}</Badge>
						<Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
							<RefreshCwIcon className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
							Refresh
						</Button>
					</div>
				</div>
				{query.error ? (
					<div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
						{query.error instanceof Error ? query.error.message : "Failed to load PM state"}
					</div>
				) : null}
			</div>

			<div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
				<StatCard label="Boxes" value={state.boxes.length} caption="daemon peers observed" icon={ServerIcon} />
				<StatCard label="Sessions" value={state.sessions.length} caption="OpenCode sessions in flight" icon={ActivityIcon} />
				<StatCard label="Working" value={workingCount} caption="lanes actively moving" icon={WorkflowIcon} tone="text-emerald-600 dark:text-emerald-300" />
				<StatCard label="Ready frontier" value={readyCount} caption="dispatchable Plane work" icon={TicketIcon} />
				<StatCard label="Needs Chris" value={needsChrisCount || humanGatedCount} caption="human-gated attention" icon={CircleAlertIcon} tone={(needsChrisCount || humanGatedCount) > 0 ? "text-rose-600 dark:text-rose-300" : undefined} />
			</div>

			{(state.needsChris.length > 0 || humanGatedCount > 0) ? (
				<Section eyebrow="Only human work" title="Needs Chris">
					<div className="grid gap-3 lg:grid-cols-2">
						{state.needsChris.length > 0 ? state.needsChris.map((item, index) => <NeedsChrisCard key={`${item.ticket ?? item.title ?? "need"}-${index}`} item={item} />) : null}
						{humanGatedCount > 0 ? (
							<div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 shadow-sm">
								<div className="flex items-center gap-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
									<CircleAlertIcon className="size-4" />
									{humanGatedCount} Plane tickets are human-gated
								</div>
								<div className="mt-2 text-sm leading-6 text-muted-foreground">{state.plane.humanGated?.note ?? "Blocked in Plane without a dependency edge; these need a Chris decision."}</div>
							</div>
						) : null}
					</div>
				</Section>
			) : null}

			<div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
				<Section eyebrow="Runtime mesh" title="Box health">
					<div className="grid gap-3 md:grid-cols-2">
						{state.boxes.length > 0 ? state.boxes.map((box) => <BoxCard key={box.id} box={box} />) : <div className="text-sm text-muted-foreground">No box projections yet.</div>}
					</div>
				</Section>

				<Section eyebrow="Control plane" title="Plane frontier">
					<div className="grid gap-3">
						<div className="grid grid-cols-2 gap-3">
							<div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
								<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Projects</div>
								<div className="mt-2 text-2xl font-semibold text-foreground">{state.plane.projects ?? 0}</div>
							</div>
							<div className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3">
								<div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Epics</div>
								<div className="mt-2 text-2xl font-semibold text-foreground">{state.plane.epics ?? 0}</div>
							</div>
						</div>
						<div className="space-y-2">
							{state.plane.readyFrontier.length > 0 ? state.plane.readyFrontier.slice(0, 5).map((ticket) => <FrontierRow key={ticket.ticket} ticket={ticket} />) : <div className="text-sm text-muted-foreground">No ready frontier items.</div>}
						</div>
					</div>
				</Section>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
				<Section eyebrow="YOLO view" title="Sessions and lanes">
					<div className="grid gap-2">
						<div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-3 px-4 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							<div>Session</div>
							<div>Repo / box</div>
							<div>Lane</div>
							<div>Status</div>
						</div>
						{state.sessions.length > 0 ? state.sessions.map((session) => <SessionRow key={session.id} session={session} lane={lanesBySession.get(session.id)} />) : <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">No live sessions in the PM feed.</div>}
					</div>
				</Section>

				<Section eyebrow="Background work" title="Background agents">
					<div className="grid gap-3">
						{state.backgroundAgents.length > 0 ? state.backgroundAgents.map((agent, index) => <BackgroundAgentCard key={`${agent.task}-${index}`} agent={agent} />) : <div className="text-sm text-muted-foreground">No background agents reported.</div>}
					</div>
				</Section>
			</div>

			<div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
				<Section eyebrow="Recent wins" title="Completions">
					<div className="grid gap-2">
						{state.recentCompletions.length > 0 ? state.recentCompletions.map((item, index) => (
							<div key={`${item}-${index}`} className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-foreground">
								<div className="flex items-start gap-3">
									<CheckCircle2Icon className="mt-0.5 size-4 text-emerald-500" />
									<span className="leading-6">{item}</span>
								</div>
							</div>
						)) : <div className="text-sm text-muted-foreground">No recent completions yet.</div>}
					</div>
				</Section>

				<Section eyebrow="Feed details" title="Source + cadence">
					<div className="grid gap-3 text-sm text-muted-foreground">
						<div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
							<div className="font-medium text-foreground">Generated by</div>
							<div className="mt-1">{state.generatedBy ?? "--"}</div>
						</div>
						<div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
							<div className="font-medium text-foreground">Updated</div>
							<div className="mt-1">{state.updatedAt ?? "--"}</div>
							<div className="mt-1 text-xs">{formatTimeAgo(state.updatedAt)}</div>
						</div>
						<div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
							<div className="font-medium text-foreground">Adapter</div>
							<div className="mt-1 leading-6">Reading `pm-state.json` via the local Firefly server today; ready to swap to daemon HTTP with one fetch change.</div>
						</div>
					</div>
				</Section>
			</div>
		</div>
	)
}
