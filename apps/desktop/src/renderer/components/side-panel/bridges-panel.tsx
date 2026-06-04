import { useQuery } from "@tanstack/react-query"
import { Button } from "@ch5me/palot-ui/components/button"
import { cn } from "@ch5me/palot-ui/lib/utils"
import {
	ActivityIcon,
	ArrowDownLeftIcon,
	ArrowUpRightIcon,
	AtSignIcon,
	CameraIcon,
	HashIcon,
	Link2Icon,
	MailIcon,
	MessageCircleIcon,
	MessageSquareDotIcon,
	MessageSquareIcon,
	PlugIcon,
	RadioIcon,
	RefreshCwIcon,
	SendIcon,
	SparklesIcon,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { Agent } from "../../lib/types"
import {
	fetchBridgeActivity,
	fetchBridges,
	type BridgeActivityResult,
	type BridgeChannel,
	type BridgeMessage,
} from "../../services/backend"

interface BridgesPanelProps {
	agent: Agent
	className?: string
}

function useBridgeRoster() {
	return useQuery({
		queryKey: ["bridges-surface-roster"],
		queryFn: fetchBridges,
		staleTime: 15_000,
		refetchInterval: 15_000,
	})
}

function useBridgeActivity(channelId: string, enabled: boolean) {
	return useQuery<BridgeActivityResult>({
		queryKey: ["bridges-surface-activity", channelId],
		queryFn: () => fetchBridgeActivity(channelId, 8),
		enabled,
		staleTime: 10_000,
		refetchInterval: enabled ? 10_000 : false,
	})
}

function channelIcon(channelId: string) {
	switch (channelId) {
		case "whatsapp":
			return <MessageCircleIcon className="size-4 text-emerald-500" aria-hidden="true" />
		case "instagram":
			return <CameraIcon className="size-4 text-foreground" aria-hidden="true" />
		case "threads":
			return <AtSignIcon className="size-4 text-foreground" aria-hidden="true" />
		case "gchat":
			return <MessageSquareIcon className="size-4 text-foreground" aria-hidden="true" />
		case "x":
			return <HashIcon className="size-4 text-foreground" aria-hidden="true" />
		case "telegram":
			return <SendIcon className="size-4 text-foreground" aria-hidden="true" />
		case "skills":
			return <SparklesIcon className="size-4 text-foreground" aria-hidden="true" />
		case "gmail":
			return <MailIcon className="size-4 text-foreground" aria-hidden="true" />
		case "imessage":
			return <MessageSquareDotIcon className="size-4 text-foreground" aria-hidden="true" />
		default:
			return <PlugIcon className="size-4 text-foreground" aria-hidden="true" />
	}
}

function statusTone(status: BridgeChannel["status"]) {
	switch (status) {
		case "connected":
			return {
				dot: "bg-emerald-500",
				label: "Live",
				text: "text-emerald-600 dark:text-emerald-400",
				card: "border-emerald-500/20 bg-emerald-500/5",
			}
		case "disconnected":
			return {
				dot: "bg-amber-500",
				label: "Offline",
				text: "text-amber-600 dark:text-amber-400",
				card: "border-amber-500/20 bg-amber-500/5",
			}
		default:
			return {
				dot: "bg-muted-foreground/40",
				label: "Planned",
				text: "text-muted-foreground",
				card: "border-border bg-muted/10",
			}
	}
}

function humanizeDuration(value: string | null) {
	if (!value) return null
	const match = value.trim().match(/(\d+)\s*(s|m|h|d|w)/i)
	if (!match) return value.trim()
	const amount = Number(match[1])
	switch (match[2].toLowerCase()) {
		case "s":
			return "moments"
		case "m":
			return `${amount} min`
		case "h":
			return `${amount} ${amount === 1 ? "hour" : "hours"}`
		case "d":
			return `${amount} ${amount === 1 ? "day" : "days"}`
		default:
			return `${amount} ${amount === 1 ? "week" : "weeks"}`
	}
}

function healthSentence(channel: BridgeChannel) {
	const parts = [channel.alive ? "reachable" : "configured"]
	const uptime = humanizeDuration(channel.uptime)
	if (uptime && uptime !== "moments") parts.push(`up for ${uptime}`)
	const last = humanizeDuration(channel.lastActivityAgo)
	if (last) parts.push(last === "moments" ? "active just now" : `last activity ${last} ago`)
	return parts.join(" · ")
}

function MessageRow({ message }: { message: BridgeMessage }) {
	const outbound = message.direction === "out"
	return (
		<div
			className={cn(
				"flex max-w-[92%] flex-col gap-1 rounded-lg border px-2.5 py-2",
				outbound
					? "self-end border-sky-500/20 bg-sky-500/8"
					: "self-start border-border bg-background/80",
			)}
		>
			<div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
				{outbound ? (
					<ArrowUpRightIcon className="size-3 text-sky-500" aria-hidden="true" />
				) : (
					<ArrowDownLeftIcon className="size-3 text-emerald-500" aria-hidden="true" />
				)}
				<span className="truncate font-medium text-foreground">{message.peer}</span>
				<span className="ml-auto shrink-0">{message.ts}</span>
				{message.tsAgo && <span className="shrink-0">· {message.tsAgo} ago</span>}
			</div>
			{message.text ? <p className="text-[11px] leading-5 text-foreground">{message.text}</p> : null}
		</div>
	)
}

function BridgeCard({ channel }: { channel: BridgeChannel }) {
	const [open, setOpen] = useState(channel.status === "connected")
	const tone = statusTone(channel.status)
	const activity = useBridgeActivity(channel.id, open && channel.status === "connected")
	const summary = useMemo(() => {
		if (channel.status === "soon") return "Connector planned but not wired into Palot yet."
		if (channel.status === "disconnected") return "Known integration lane with no active runtime signal."
		return healthSentence(channel)
	}, [channel])

	return (
		<div className={cn("rounded-xl border p-3", tone.card)}>
			<div className="flex items-start gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background/80">
					{channelIcon(channel.id)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h4 className="truncate text-sm font-medium text-foreground">{channel.name}</h4>
						<span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
							{channel.kind}
						</span>
					</div>
					<div className="mt-1 flex items-center gap-2 text-[11px]">
						<span className={cn("size-2 rounded-full", tone.dot)} />
						<span className={tone.text}>{tone.label}</span>
						{channel.messagesTotal != null && (
							<span className="text-muted-foreground">· {channel.messagesTotal.toLocaleString()} events</span>
						)}
					</div>
					<p className="mt-2 text-xs leading-5 text-muted-foreground">{summary}</p>
				</div>
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
				{channel.today != null ? <span>Today {channel.today.toLocaleString()}</span> : null}
				{channel.launchd ? <span>Service {channel.launchd}</span> : null}
				{channel.pid != null ? <span>PID {channel.pid}</span> : null}
			</div>

			{channel.status === "connected" ? (
				<div className="mt-3">
					<Button type="button" variant="outline" size="sm" onClick={() => setOpen((value) => !value)}>
						<ActivityIcon className="size-4" aria-hidden="true" />
						{open ? "Hide activity" : "Show activity"}
					</Button>
					{open ? (
						<div className="mt-3 flex max-h-64 flex-col gap-2 overflow-auto rounded-lg border border-border bg-muted/10 p-2">
							{activity.isLoading ? (
								<div className="text-xs text-muted-foreground">Loading activity...</div>
							) : activity.data?.messages.length ? (
								activity.data.messages.map((message, index) => (
									<MessageRow key={`${message.ts}-${message.peer}-${index}`} message={message} />
								))
							) : (
								<div className="text-xs text-muted-foreground">No recent bridge activity.</div>
							)}
						</div>
					) : null}
				</div>
			) : (
				<div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
					<span>
						{channel.status === "soon"
							? "Keep this lane visible while integrations architecture lands."
							: "Connection details belong in provider config and future connector settings."}
					</span>
					<Button type="button" variant="outline" size="sm" disabled>
						<Link2Icon className="size-4" aria-hidden="true" />
						Connect
					</Button>
				</div>
			)}
		</div>
	)
}

export function BridgesPanel({ agent, className }: BridgesPanelProps) {
	const bridges = useBridgeRoster()
	const channels = bridges.data?.bridges ?? []
	const connectedCount = channels.filter((channel) => channel.status === "connected").length

	return (
		<div className={cn("flex h-full min-h-0 flex-col bg-background", className)}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<RadioIcon className="size-4 text-foreground" aria-hidden="true" />
							<h3 className="text-sm font-medium text-foreground">Bridges</h3>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Integration hub for {agent.project}: agent runtime, tool rails, and connector backlog.
						</p>
					</div>
					<Button type="button" variant="outline" size="sm" onClick={() => void bridges.refetch()}>
						<RefreshCwIcon className="size-4" aria-hidden="true" />
						Refresh
					</Button>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<div className="grid gap-3 md:grid-cols-3">
					<div className="rounded-xl border border-border bg-muted/10 px-3 py-3">
						<div className="text-[11px] uppercase tracking-wide text-muted-foreground">Connected</div>
						<div className="mt-2 text-2xl font-semibold text-foreground">{connectedCount}</div>
					</div>
					<div className="rounded-xl border border-border bg-muted/10 px-3 py-3">
						<div className="text-[11px] uppercase tracking-wide text-muted-foreground">Visible lanes</div>
						<div className="mt-2 text-2xl font-semibold text-foreground">{channels.length}</div>
					</div>
					<div className="rounded-xl border border-border bg-muted/10 px-3 py-3">
						<div className="text-[11px] uppercase tracking-wide text-muted-foreground">Current stance</div>
						<div className="mt-2 text-sm font-medium text-foreground">Info architecture first</div>
						<p className="mt-1 text-xs text-muted-foreground">Use this surface as the connectors map before per-vendor setup flows exist.</p>
					</div>
				</div>

				<div className="rounded-xl border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
					Bridges is the integration home, distinct from Plugins. Plugins show OpenCode-native capabilities. Bridges shows the broader connector map: what is live, what is planned, and where activity is flowing.
				</div>

				{bridges.isLoading && channels.length === 0 ? (
					<div className="text-xs text-muted-foreground">Loading bridges...</div>
				) : bridges.error ? (
					<div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3 text-xs text-destructive">
						{bridges.error instanceof Error ? bridges.error.message : "Failed to load bridges."}
					</div>
				) : channels.length > 0 ? (
					<div className="space-y-3">
						{channels.map((channel) => (
							<BridgeCard key={channel.id} channel={channel} />
						))}
					</div>
				) : (
					<div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 px-4 py-10 text-center">
						<SparklesIcon className="size-5 text-muted-foreground" aria-hidden="true" />
						<p className="mt-3 text-sm font-medium text-foreground">No bridges exposed yet</p>
						<p className="mt-1 max-w-sm text-xs text-muted-foreground">
							Start by wiring connector inventory into this surface, then add per-integration auth and activity flows.
						</p>
					</div>
				)}
			</div>
		</div>
	)
}
