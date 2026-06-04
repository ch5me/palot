import { Button } from "@ch5me/elf-ui/components/button"
import { Input } from "@ch5me/elf-ui/components/input"
import { useQuery } from "@tanstack/react-query"
import { ActivityIcon, AlertTriangleIcon, BlocksIcon, CircleCheckIcon, Loader2Icon, RadioIcon, RefreshCwIcon, Rows4Icon, TicketIcon, WavesIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { queryClient } from "../lib/query-client"
import { fetchCh5PmDashboard, subscribeToCh5PmEvents } from "./client"
import { MOCK_CH5PM_DASHBOARD_STATE } from "./fixtures"
import type { Ch5PmDashboardState } from "./types"

interface Ch5PmDashboardPanelProps {
	className?: string
}

const DEFAULT_BASE_URL = "http://127.0.0.1:43130"

function formatTimestamp(value?: string | null): string {
	if (!value) return "--"
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function StatCard({
	label,
	value,
	icon: Icon,
	tone = "text-foreground",
}: {
	label: string
	value: string | number
	icon: typeof TicketIcon
	tone?: string
}) {
	return (
		<div className="rounded-xl border border-border/70 bg-card/70 p-3">
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<Icon className="size-3.5" aria-hidden="true" />
				{label}
			</div>
			<div className={`mt-2 text-lg font-semibold ${tone}`}>{value}</div>
		</div>
	)
}

function SectionCard({
	title,
	children,
}: {
	title: string
	children: React.ReactNode
}) {
	return (
		<section className="rounded-xl border border-border/70 bg-card/50 p-3">
			<div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
				{title}
			</div>
			{children}
		</section>
	)
}

export function Ch5PmDashboardPanel({ className }: Ch5PmDashboardPanelProps) {
	const [baseUrlInput, setBaseUrlInput] = useState(DEFAULT_BASE_URL)
	const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL)
	const [streamState, setStreamState] = useState<
		Pick<Ch5PmDashboardState, "streamConnected" | "streamError" | "lastEventAt">
	>({
		streamConnected: false,
		streamError: null,
		lastEventAt: null,
	})

	const query = useQuery({
		queryKey: ["ch5pm-dashboard", baseUrl],
		queryFn: () => fetchCh5PmDashboard(baseUrl),
		initialData: MOCK_CH5PM_DASHBOARD_STATE,
		staleTime: 30_000,
		refetchInterval: 60_000,
	})

	useEffect(() => {
		const unsubscribe = subscribeToCh5PmEvents(baseUrl, {
			onOpen: () => {
				setStreamState({
					streamConnected: true,
					streamError: null,
					lastEventAt: new Date().toISOString(),
				})
			},
			onHeartbeat: () => {
				setStreamState((current) => ({
					...current,
					streamConnected: true,
					streamError: null,
					lastEventAt: new Date().toISOString(),
				}))
			},
			onSnapshot: (snapshot) => {
				queryClient.setQueryData<Ch5PmDashboardState>(["ch5pm-dashboard", baseUrl], (current) => ({
					...(current ?? MOCK_CH5PM_DASHBOARD_STATE),
					snapshot,
				}))
				setStreamState((current) => ({
					...current,
					streamConnected: true,
					streamError: null,
					lastEventAt: new Date().toISOString(),
				}))
			},
			onPressure: (pressure) => {
				queryClient.setQueryData<Ch5PmDashboardState>(["ch5pm-dashboard", baseUrl], (current) => ({
					...(current ?? MOCK_CH5PM_DASHBOARD_STATE),
					pressure,
				}))
				setStreamState((current) => ({
					...current,
					streamConnected: true,
					streamError: null,
					lastEventAt: new Date().toISOString(),
				}))
			},
			onSystem: (system) => {
				queryClient.setQueryData<Ch5PmDashboardState>(["ch5pm-dashboard", baseUrl], (current) => ({
					...(current ?? MOCK_CH5PM_DASHBOARD_STATE),
					system,
				}))
				setStreamState((current) => ({
					...current,
					streamConnected: true,
					streamError: null,
					lastEventAt: new Date().toISOString(),
				}))
			},
			onError: (message) => {
				setStreamState((current) => ({
					...current,
					streamConnected: false,
					streamError: message,
				}))
			},
		})

		return unsubscribe
	}, [baseUrl])

	const data = query.data ?? MOCK_CH5PM_DASHBOARD_STATE
	const snapshot = data.snapshot ?? MOCK_CH5PM_DASHBOARD_STATE.snapshot
	const pressure =
		data.pressure ?? snapshot?.runtime?.resourcePressure ?? MOCK_CH5PM_DASHBOARD_STATE.pressure
	const system = data.system ?? MOCK_CH5PM_DASHBOARD_STATE.system
	const runtimeBoxes = snapshot?.runtime?.boxes ?? []
	const slotRows = snapshot?.runtime?.cmux?.slots ?? []
	const activeTickets = snapshot?.activeTickets ?? []
	const queueTickets = snapshot?.queueTickets ?? []
	const blockedTickets = snapshot?.blockedTickets ?? []
	const completedTickets = snapshot?.closedSessionSignals ?? []
	const sessionSignals = snapshot?.sessionSignals ?? []
	const brief = snapshot?.managerBrief ?? "No manager brief yet"
	const pressureLevel = pressure?.pressure?.level ?? "unknown"
	const pressureScore = pressure?.pressure?.score ?? "--"
	const activeDisplayBox = snapshot?.clusterDisplay?.activeDisplayBoxId ?? "--"
	const lastGeneratedAt = snapshot?.generatedAt ?? pressure?.generatedAt ?? system?.generatedAt ?? null

	const summary = useMemo(
		() => [
			{ label: "Active", value: activeTickets.length, icon: TicketIcon },
			{ label: "Queued", value: queueTickets.length, icon: Rows4Icon },
			{
				label: "Blocked",
				value: blockedTickets.length,
				icon: AlertTriangleIcon,
				tone: blockedTickets.length > 0 ? "text-amber-500" : "text-foreground",
			},
			{
				label: "Live Slots",
				value: slotRows.filter((slot) => slot.state === "assigned").length,
				icon: BlocksIcon,
			},
		],
		[activeTickets.length, blockedTickets.length, queueTickets.length, slotRows],
	)

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h3 className="text-sm font-medium text-foreground">CH5PM Dashboard</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							React scaffold for the daemon-backed operator cockpit.
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => void query.refetch()}
						disabled={query.isFetching}
					>
						{query.isFetching ? (
							<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<RefreshCwIcon className="size-4" aria-hidden="true" />
						)}
						Refresh
					</Button>
				</div>
				<form
					className="mt-3 flex gap-2"
					onSubmit={(event) => {
						event.preventDefault()
						setBaseUrl(baseUrlInput.trim() || DEFAULT_BASE_URL)
					}}
				>
					<Input
						value={baseUrlInput}
						onChange={(event) => setBaseUrlInput(event.target.value)}
						aria-label="CH5PM daemon base URL"
					/>
					<Button type="submit" variant="outline" size="sm">
						Connect
					</Button>
				</form>
			</div>

			<div className="min-h-0 flex-1 overflow-auto px-4 py-4">
				<div className="grid gap-3">
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						{summary.map((item) => (
							<StatCard
								key={item.label}
								label={item.label}
								value={item.value}
								icon={item.icon}
								tone={item.tone}
							/>
						))}
					</div>

					<SectionCard title="Transport">
						<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							<span className="inline-flex items-center gap-1 rounded-full border border-border/70 px-2 py-1">
								<RadioIcon
									className={`size-3 ${streamState.streamConnected ? "text-emerald-500" : "text-muted-foreground"}`}
									aria-hidden="true"
								/>
								{streamState.streamConnected ? "SSE live" : "Polling fallback"}
							</span>
							<span>Base URL {baseUrl}</span>
							<span>Last payload {formatTimestamp(lastGeneratedAt)}</span>
							<span>Last event {formatTimestamp(streamState.lastEventAt)}</span>
						</div>
						{streamState.streamError ? (
							<p className="mt-2 text-xs text-amber-500">{streamState.streamError}</p>
						) : null}
					</SectionCard>

					<SectionCard title="Brief">
						<p className="text-sm leading-6 text-foreground">{brief}</p>
						<div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
							<span>Pressure {pressureLevel}</span>
							<span>Score {pressureScore}</span>
							<span>Display {activeDisplayBox}</span>
						</div>
					</SectionCard>

					<div className="grid gap-3 xl:grid-cols-2">
						<SectionCard title="Active Tickets">
							<div className="grid gap-2">
								{activeTickets.length ? (
									activeTickets.map((ticket) => (
										<div
											key={ticket.ticketId ?? ticket.id}
											className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs"
										>
											<div className="font-medium text-foreground">
												{ticket.ticketId ?? ticket.id ?? "Unknown ticket"}
											</div>
											<div className="mt-1 text-muted-foreground">
												{ticket.name ?? ticket.title ?? "Untitled"}
											</div>
											<div className="mt-1 text-muted-foreground">
												{[ticket.repo, ticket.boxId, ticket.slotId].filter(Boolean).join(" · ")}
											</div>
										</div>
									))
								) : (
									<div className="text-xs text-muted-foreground">No active tickets.</div>
								)}
							</div>
						</SectionCard>

						<SectionCard title="Queue / Blocked">
							<div className="grid gap-3 text-xs">
								<div>
									<div className="mb-1 font-medium text-foreground">Queued</div>
									{queueTickets.length ? (
										queueTickets.map((ticket) => (
											<div
												key={ticket.ticketId ?? ticket.id}
												className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-muted-foreground"
											>
												{ticket.ticketId ?? ticket.id} · {ticket.name ?? ticket.title ?? "Untitled"}
											</div>
										))
									) : (
										<div className="text-muted-foreground">No queued tickets.</div>
									)}
								</div>
								<div>
									<div className="mb-1 font-medium text-foreground">Blocked</div>
									{blockedTickets.length ? (
										blockedTickets.map((ticket) => (
											<div
												key={ticket.ticketId ?? ticket.id}
												className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-amber-600 dark:text-amber-400"
											>
												{ticket.ticketId ?? ticket.id} · {ticket.name ?? ticket.title ?? "Untitled"}
											</div>
										))
									) : (
										<div className="text-muted-foreground">No blocked tickets.</div>
									)}
								</div>
							</div>
						</SectionCard>
					</div>

					<div className="grid gap-3 xl:grid-cols-2">
						<SectionCard title="Cluster Nodes">
							<div className="grid gap-2">
								{runtimeBoxes.length ? (
									runtimeBoxes.map((box) => (
										<div
											key={box.boxId}
											className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs"
										>
											<div className="flex items-center justify-between gap-2">
												<span className="font-medium text-foreground">{box.boxId ?? "unknown"}</span>
												<span className={box.dispatchEligible ? "text-emerald-500" : "text-muted-foreground"}>
													{box.dispatchEligible ? "dispatchable" : "observe"}
												</span>
											</div>
											<div className="mt-1 text-muted-foreground">
												{[box.nodeType, box.hub ? "hub" : undefined].filter(Boolean).join(" · ")}
											</div>
										</div>
									))
								) : (
									<div className="text-xs text-muted-foreground">No node projections.</div>
								)}
							</div>
						</SectionCard>

						<SectionCard title="Worker Slots">
							<div className="grid gap-2">
								{slotRows.length ? (
									slotRows.map((slot, index) => (
										<div
											key={`${slot.ticketId ?? "slot"}-${index}`}
											className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs"
										>
											<div className="font-medium text-foreground">
												{slot.ticketId ?? "Unassigned slot"}
											</div>
											<div className="mt-1 text-muted-foreground">
												{[slot.slotKey, slot.state].filter(Boolean).join(" · ")}
											</div>
											<div className="mt-1 text-muted-foreground">
												{slot.workerLive ? "Worker live" : "Worker not live"}
											</div>
										</div>
									))
								) : (
									<div className="text-xs text-muted-foreground">No slot data.</div>
								)}
							</div>
						</SectionCard>
					</div>

					<div className="grid gap-3 xl:grid-cols-2">
						<SectionCard title="Completed / Reviewable">
							<div className="grid gap-2">
								{completedTickets.length ? (
									completedTickets.map((ticket) => (
										<div
											key={ticket.ticketId ?? ticket.sessionId}
											className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs"
										>
											<div className="font-medium text-foreground">
												{ticket.ticketId ?? ticket.sessionId ?? "Closed session"}
											</div>
											<div className="mt-1 text-muted-foreground">
												{ticket.statusLine ?? ticket.title ?? "No summary"}
											</div>
										</div>
									))
								) : (
									<div className="text-xs text-muted-foreground">No completed sessions.</div>
								)}
							</div>
						</SectionCard>

						<SectionCard title="Signals / Attention">
							<div className="grid gap-3 text-xs">
								<div>
									<div className="mb-1 inline-flex items-center gap-2 font-medium text-foreground">
										<ActivityIcon className="size-3.5" aria-hidden="true" /> Session signals
									</div>
									{sessionSignals.length ? (
										sessionSignals.map((signal) => (
											<div
												key={signal.sessionId}
												className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-muted-foreground"
											>
												{signal.title ?? signal.sessionId ?? "Unknown session"} · {signal.signal ?? signal.state ?? "state unknown"}
											</div>
										))
									) : (
										<div className="text-muted-foreground">No session signals.</div>
									)}
								</div>
								<div>
									<div className="mb-1 inline-flex items-center gap-2 font-medium text-foreground">
										<WavesIcon className="size-3.5" aria-hidden="true" /> Attention queue
									</div>
									<div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-muted-foreground">
										{snapshot?.attentionMetrics?.openRequestCount ?? 0} open request(s)
									</div>
								</div>
							</div>
						</SectionCard>
					</div>
				</div>
			</div>

			<div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
				<div className="flex flex-wrap items-center gap-3">
					<span className="inline-flex items-center gap-1">
						<CircleCheckIcon className="size-3.5 text-emerald-500" aria-hidden="true" />
						Shell scaffold landed
					</span>
					<span>Mock fixture included for offline proof</span>
					<span>Live daemon transport ready for typed contract follow-up</span>
				</div>
			</div>
		</div>
	)
}
