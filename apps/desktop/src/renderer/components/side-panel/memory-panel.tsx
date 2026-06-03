import { PinIcon, SearchIcon, SparklesIcon, XIcon } from "lucide-react"
import { useAtomValue, useSetAtom } from "jotai"
import { useEffect, useMemo, useState } from "react"
import {
	addPinnedFactAtom,
	pinnedFactsAtom,
	removePinnedFactAtom,
} from "../../atoms/preferences"
import type { Agent } from "../../lib/types"

interface MemoryPanelProps {
	agent: Agent
	className?: string
}

function formatRelativeTime(createdAt: number): string {
	const diffSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000))
	if (diffSeconds < 5) return "just now"
	if (diffSeconds < 60) return `${diffSeconds}s ago`

	const diffMinutes = Math.floor(diffSeconds / 60)
	if (diffMinutes < 60) return `${diffMinutes}m ago`

	const diffHours = Math.floor(diffMinutes / 60)
	if (diffHours < 24) return `${diffHours}h ago`

	const diffDays = Math.floor(diffHours / 24)
	return `${diffDays}d ago`
}

export function MemoryPanel({ agent, className }: MemoryPanelProps) {
	const [draft, setDraft] = useState("")
	const [searchQuery, setSearchQuery] = useState("")
	const [, setTick] = useState(0)
	const factsByProject = useAtomValue(pinnedFactsAtom)
	const addPinnedFact = useSetAtom(addPinnedFactAtom)
	const removePinnedFact = useSetAtom(removePinnedFactAtom)

	useEffect(() => {
		const id = setInterval(() => setTick((t) => t + 1), 60_000)
		return () => clearInterval(id)
	}, [])
	const projectFacts = useMemo(() => factsByProject[agent.project] ?? [], [agent.project, factsByProject])
	const filteredFacts = useMemo(() => {
		if (!searchQuery.trim()) return projectFacts
		const query = searchQuery.toLowerCase()
		return projectFacts.filter((f) => f.text.toLowerCase().includes(query))
	}, [projectFacts, searchQuery])

	const handlePin = () => {
		const text = draft.trim()
		if (!text) return
		addPinnedFact({ projectKey: agent.project, text })
		setDraft("")
	}

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Memory</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					Staging surface for durable Firefly memory cues in {agent.project}.
				</p>
			</div>
			<div className="flex flex-1 min-h-0 flex-col gap-3 px-4 py-4">
				<div className="rounded-xl border border-border/70 bg-muted/20 p-3">
					<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
						<PinIcon className="size-3.5" aria-hidden="true" />
						Pin project fact
					</div>
					<textarea
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="Capture durable fact, note, or reminder for this project"
						className="mt-3 min-h-24 w-full resize-none rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-foreground/20"
					/>
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							onClick={handlePin}
							disabled={!draft.trim()}
							className="rounded-lg border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
						>
							Pin
						</button>
					</div>
				</div>
				{projectFacts.length > 0 && (
					<div className="relative">
						<SearchIcon className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
						<input
							type="text"
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Search pinned facts..."
							className="w-full rounded-xl border border-border/70 bg-background py-2 pl-8 pr-3 text-sm text-foreground outline-none transition focus:border-foreground/20"
						/>
					</div>
				)}
				<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pb-1">
					{projectFacts.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center">
							<SparklesIcon className="size-4 text-muted-foreground" aria-hidden="true" />
							<p className="mt-3 text-sm font-medium text-foreground">No pinned facts yet</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Pin stable context for {agent.project} so next session starts smarter.
							</p>
						</div>
					) : filteredFacts.length === 0 ? (
						<p className="text-center text-xs text-muted-foreground py-4">No facts match "{searchQuery}"</p>
					) : (
						filteredFacts.map((fact) => (
							<div key={fact.id} className="rounded-xl border border-border/70 bg-muted/20 p-3">
								<p className="whitespace-pre-wrap text-sm text-foreground">{fact.text}</p>
								<div className="mt-3 flex items-center justify-between gap-3">
									<span className="text-xs text-muted-foreground">
										{formatRelativeTime(fact.createdAt)}
									</span>
									<button
										type="button"
										onClick={() =>
											removePinnedFact({ projectKey: agent.project, factId: fact.id })
										}
										className="rounded-md p-1 text-muted-foreground transition hover:bg-background hover:text-foreground"
										aria-label="Delete pinned fact"
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
