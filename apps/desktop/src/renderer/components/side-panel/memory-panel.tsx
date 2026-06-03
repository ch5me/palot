import { PinIcon, SearchIcon, SparklesIcon, XIcon } from "lucide-react"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
	addPinnedFactAtom,
	memoryApiConfigAtom,
	memoryModeAtom,
	pinnedFactsAtom,
	removePinnedFactAtom,
	type MemoryMode,
} from "../../atoms/preferences"
import type { MemoryItem } from "../../services/memory-service"
import { fetchMemories, addRemoteMemory, removeRemoteMemory } from "../../services/memory-service"
import type { Agent } from "../../lib/types"

interface MemoryPanelProps {
	agent: Agent
	className?: string
}

function formatRelativeTime(isoString: string): string {
	const diffSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(isoString)) / 1000))
	if (diffSeconds < 5) return "just now"
	if (diffSeconds < 60) return `${diffSeconds}s ago`
	const diffMinutes = Math.floor(diffSeconds / 60)
	if (diffMinutes < 60) return `${diffMinutes}m ago`
	const diffHours = Math.floor(diffMinutes / 60)
	if (diffHours < 24) return `${diffHours}h ago`
	const diffDays = Math.floor(diffHours / 24)
	return `${diffDays}d ago`
}

const MODE_LABELS: Record<MemoryMode, string> = {
	local: "Local",
	hybrid: "Hybrid",
	remote: "Remote",
}

export function MemoryPanel({ agent, className }: MemoryPanelProps) {
	const [draft, setDraft] = useState("")
	const [searchQuery, setSearchQuery] = useState("")
	const [items, setItems] = useState<MemoryItem[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [, setTick] = useState(0)

	const factsByProject = useAtomValue(pinnedFactsAtom)
	const addPinnedFact = useSetAtom(addPinnedFactAtom)
	const removePinnedFact = useSetAtom(removePinnedFactAtom)
	const memoryMode = useAtomValue(memoryModeAtom)
	const setMemoryMode = useSetAtom(memoryModeAtom)
	const apiConfig = useAtomValue(memoryApiConfigAtom)

	const localFacts = useMemo(() => factsByProject[agent.project] ?? [], [agent.project, factsByProject])

	const loadMemories = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const results = await fetchMemories(
				{
					mode: memoryMode,
					apiBaseUrl: apiConfig.apiBaseUrl,
					projectId: agent.project,
					userId: apiConfig.userId || "default",
				},
				localFacts,
				agent.project,
				searchQuery || undefined,
			)
			setItems(results)
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load memories")
			setItems(localFacts.map((f) => ({
				id: f.id,
				body: f.text,
				memoryClass: "fact",
				createdAt: new Date(f.createdAt).toISOString(),
				updatedAt: new Date(f.createdAt).toISOString(),
				source: "local" as const,
			})))
		} finally {
			setLoading(false)
		}
	}, [memoryMode, apiConfig, localFacts, agent.project, searchQuery])

	useEffect(() => {
		loadMemories()
	}, [loadMemories])

	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 60_000)
		return () => clearInterval(id)
	}, [])

	const handlePin = async () => {
		const text = draft.trim()
		if (!text) return
		if (memoryMode === "remote" || memoryMode === "hybrid") {
			try {
				await addRemoteMemory(
					{ mode: memoryMode, apiBaseUrl: apiConfig.apiBaseUrl, projectId: agent.project, userId: apiConfig.userId || "default" },
					text,
				)
			} catch {
				// Remote write failed, still save locally
			}
		}
		addPinnedFact({ projectKey: agent.project, text })
		setDraft("")
		loadMemories()
	}

	const handleRemove = async (item: MemoryItem) => {
		if (item.source === "remote" && (memoryMode === "remote" || memoryMode === "hybrid")) {
			try {
				await removeRemoteMemory(
					{ mode: memoryMode, apiBaseUrl: apiConfig.apiBaseUrl, projectId: agent.project, userId: apiConfig.userId || "default" },
					item.id,
				)
			} catch {
				// Remote delete failed
			}
		}
		if (item.source === "local") {
			removePinnedFact({ projectKey: agent.project, factId: item.id })
		}
		loadMemories()
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-medium text-foreground">Memory</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Durable memory cues for {agent.project}.
						</p>
					</div>
					<select
						value={memoryMode}
						onChange={(event) => setMemoryMode(event.target.value as MemoryMode)}
						className="rounded-lg border border-border/70 bg-background px-2 py-1 text-xs text-foreground outline-none"
					>
						<option value="local">{MODE_LABELS.local}</option>
						<option value="hybrid">{MODE_LABELS.hybrid}</option>
						<option value="remote">{MODE_LABELS.remote}</option>
					</select>
				</div>
			</div>
			<div className="flex flex-1 min-h-0 flex-col gap-3 px-4 py-4">
				{error && (
					<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
						{error}
					</div>
				)}
				<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
					<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<PinIcon className="size-3.5" aria-hidden="true" />
						{memoryMode === "remote" ? "Add memory" : "Pin project fact"}
					</div>
					<textarea
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Capture durable fact, note, or reminder"
						className="mt-3 min-h-24 w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-foreground/20"
					/>
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={handlePin}
							disabled={!draft.trim() || loading}
							className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
						>
							{memoryMode === "remote" ? "Add" : "Pin"}
						</button>
					</div>
				</div>
				{items.length > 0 && (
					<div className="relative">
						<SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
						<input
							type="text"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Search memories..."
							className="w-full rounded-xl border border-border/70 bg-background py-2 pl-8 pr-3 text-sm text-foreground outline-none transition focus:border-foreground/20"
						/>
					</div>
				)}
				<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-1">
					{loading && items.length === 0 ? (
						<div className="flex flex-1 items-center justify-center">
							<div className="size-4 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
						</div>
					) : items.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center">
							<SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
							<p className="mt-3 text-sm font-medium text-foreground">No memories yet</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Add context for {agent.project} so next session starts smarter.
							</p>
						</div>
					) : items.length === 0 && searchQuery ? (
						<p className="text-center text-xs text-muted-foreground py-4">No memories match "{searchQuery}"</p>
					) : (
						items.map((item) => (
							<div key={item.id} className="rounded-xl border border-border/70 bg-muted/20 p-3">
								<p className="whitespace-pre-wrap text-sm text-foreground">{item.body}</p>
								<div className="mt-3 flex items-center justify-between gap-3">
									<div className="flex items-center gap-2 text-xs text-muted-foreground">
										<span>{formatRelativeTime(item.createdAt)}</span>
										<span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px]">
											{item.source}
										</span>
									</div>
									<button
										type="button"
										onClick={() => handleRemove(item)}
										className="rounded-md p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
										aria-label="Delete memory"
									>
										<XIcon className="size-3.5" aria-hidden="true" />
									</button>
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	)
}
