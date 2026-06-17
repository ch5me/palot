import { Button } from "@ch5me/ch5-ui-web"
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, Loader2Icon, XIcon } from "lucide-react"
import { useState } from "react"
import {
	Ch5PmAttentionActionError,
	fmtAttentionAge,
	visibleAttentionItems,
} from "../ch5pm-dashboard/attention"
import type {
	Ch5PmAttentionItem,
	Ch5PmAttentionOption,
	Ch5PmAttentionPriority,
	Ch5PmAttentionQueue,
} from "../ch5pm-dashboard/types"
import { createLogger } from "../lib/logger"
import { cancelCh5PmAttentionItem, resolveCh5PmAttentionItem } from "../services/backend"

const log = createLogger("pm-attention-queue")

/**
 * "Needs You" panel — the PM's AskHuman attention queue (CH5COMPAC4C-305).
 *
 * Renders open human-blocked decisions from `attentionQueue` on the PM
 * live state: what / why-now / options with pros+cons / recommendation.
 * Answer → daemon resolve mutation, Dismiss → cancel mutation, with
 * optimistic removal; the 15s poll reconciles. 409/422 failures keep the
 * item visible with an inline error.
 */

const PRIORITY_BADGE: Record<Ch5PmAttentionPriority, string> = {
	p0: "bg-red-500/90 text-white",
	p1: "bg-amber-500/80 text-black",
	p2: "bg-neutral-300 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
}

function MetaChip({ label, value }: { label: string; value?: string }) {
	if (!value) return null
	return (
		<span className="inline-flex items-center gap-1 rounded-sm border border-neutral-300 px-1 py-px text-[9px] text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
			<span className="uppercase tracking-[0.12em] text-neutral-400 dark:text-neutral-500">{label}</span>
			<span className="text-neutral-600 dark:text-neutral-300">{value}</span>
		</span>
	)
}

function OptionProsCons({ option }: { option: Ch5PmAttentionOption }) {
	return (
		<div className="mt-1 space-y-0.5 pl-5">
			{(option.pros ?? []).map((pro) => (
				<div key={`pro-${pro}`} className="flex gap-1 text-[10px] leading-3.5 text-emerald-600 dark:text-emerald-400">
					<span aria-hidden="true">+</span>
					<span className="min-w-0">{pro}</span>
				</div>
			))}
			{(option.cons ?? []).map((con) => (
				<div key={`con-${con}`} className="flex gap-1 text-[10px] leading-3.5 text-red-500 dark:text-red-400">
					<span aria-hidden="true">−</span>
					<span className="min-w-0">{con}</span>
				</div>
			))}
		</div>
	)
}

function OptionRow({
	option,
	isSelected,
	isRecommended,
	disabled,
	onSelect,
}: {
	option: Ch5PmAttentionOption
	isSelected: boolean
	isRecommended: boolean
	disabled: boolean
	onSelect: () => void
}) {
	const hasDetails = (option.pros?.length ?? 0) > 0 || (option.cons?.length ?? 0) > 0
	const [expanded, setExpanded] = useState(false)

	return (
		<div
			className={`rounded-sm border px-1.5 py-1 transition-colors ${
				isSelected
					? "border-sky-500/70 bg-sky-500/10"
					: "border-neutral-200 hover:border-neutral-400 dark:border-neutral-700 dark:hover:border-neutral-500"
			}`}
		>
			<div className="flex items-start gap-1.5">
				<button
					type="button"
					aria-pressed={isSelected}
					onClick={onSelect}
					disabled={disabled}
					className={`flex min-w-0 flex-1 items-start gap-1.5 text-left ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
				>
					<span
						className={`mt-px flex size-3 shrink-0 items-center justify-center rounded-full border ${
							isSelected
								? "border-sky-500 bg-sky-500 text-white"
								: "border-neutral-400 dark:border-neutral-500"
						}`}
						aria-hidden="true"
					>
						{isSelected ? <CheckIcon className="size-2" /> : null}
					</span>
					<span className="min-w-0 text-[11px] leading-4 text-neutral-900 dark:text-neutral-100">
						{option.label}
						{isRecommended ? (
							<span className="ml-1.5 rounded-sm bg-emerald-500/15 px-1 text-[9px] uppercase tracking-[0.12em] text-emerald-600 dark:text-emerald-400">
								recommended
							</span>
						) : null}
					</span>
				</button>
				{hasDetails ? (
					<button
						type="button"
						onClick={() => setExpanded((v) => !v)}
						aria-expanded={expanded}
						aria-label={`${expanded ? "Hide" : "Show"} pros and cons for ${option.label}`}
						className="shrink-0 text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
					>
						{expanded ? <ChevronDownIcon className="size-3" /> : <ChevronRightIcon className="size-3" />}
					</button>
				) : null}
			</div>
			{expanded && hasDetails ? <OptionProsCons option={option} /> : null}
		</div>
	)
}

function AttentionItemCard({
	item,
	onSettled,
}: {
	item: Ch5PmAttentionItem
	onSettled: (id: string) => void
}) {
	const [chosenLabel, setChosenLabel] = useState<string | null>(item.recommendation ?? null)
	const [note, setNote] = useState("")
	const [submitting, setSubmitting] = useState<"answer" | "dismiss" | null>(null)
	const [error, setError] = useState<string | null>(null)

	async function run(kind: "answer" | "dismiss") {
		if (submitting) return
		if (kind === "answer" && !chosenLabel) return
		setSubmitting(kind)
		setError(null)
		try {
			const trimmedNote = note.trim()
			if (kind === "answer" && chosenLabel) {
				await resolveCh5PmAttentionItem({
					id: item.id,
					chosenLabel,
					...(trimmedNote ? { note: trimmedNote } : {}),
				})
			} else {
				await cancelCh5PmAttentionItem({
					id: item.id,
					...(trimmedNote ? { note: trimmedNote } : {}),
				})
			}
			onSettled(item.id)
		} catch (err) {
			const message =
				err instanceof Ch5PmAttentionActionError
					? err.status === 409
						? `Already settled elsewhere — it will clear on the next refresh. (${err.message})`
						: err.message
					: err instanceof Error
						? err.message
						: "Attention mutation failed"
			log.warn("attention mutation failed", { id: item.id, kind, err })
			setError(message)
		} finally {
			setSubmitting(null)
		}
	}

	return (
		<div className="border-b border-red-900/20 px-2 py-1.5 last:border-b-0">
			<div className="flex items-center gap-1.5">
				<span className={`rounded-sm px-1 py-px text-[9px] font-bold uppercase ${PRIORITY_BADGE[item.priority]}`}>
					{item.priority}
				</span>
				<span className="min-w-0 flex-1 truncate text-[11px] font-medium text-neutral-900 dark:text-neutral-100">
					{item.what}
				</span>
				<span className="shrink-0 text-[9px] text-neutral-400 dark:text-neutral-500">{fmtAttentionAge(item.createdAt)}</span>
			</div>
			<div className="mt-0.5 pl-0.5 text-[10px] leading-3.5 text-neutral-500 dark:text-neutral-400">{item.whyNow}</div>
			{item.ticketId || item.sessionID || item.repoId ? (
				<div className="mt-1 flex flex-wrap gap-1">
					<MetaChip label="ticket" value={item.ticketId} />
					<MetaChip label="session" value={item.sessionID} />
					<MetaChip label="repo" value={item.repoId} />
				</div>
			) : null}
			<div className="mt-1.5 space-y-1">
				{item.options.map((option) => (
					<OptionRow
						key={option.label}
						option={option}
						isSelected={chosenLabel === option.label}
						isRecommended={item.recommendation === option.label}
						disabled={submitting !== null}
						onSelect={() => setChosenLabel(option.label)}
					/>
				))}
			</div>
			<div className="mt-1.5 flex items-center gap-1.5">
				<input
					type="text"
					value={note}
					onChange={(e) => setNote(e.target.value)}
					placeholder="Optional note…"
					disabled={submitting !== null}
					className="h-6 min-w-0 flex-1 rounded-sm border border-neutral-300 bg-transparent px-1.5 text-[10px] text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-100 dark:placeholder:text-neutral-600"
				/>
				<Button
					size="sm"
					onClick={() => void run("answer")}
					disabled={!chosenLabel || submitting !== null}
					className="h-6 gap-1 rounded-sm px-2 text-[10px]"
					aria-label={`Answer: ${chosenLabel ?? "select an option"}`}
				>
					{submitting === "answer" ? (
						<Loader2Icon className="size-2.5 animate-spin" aria-hidden="true" />
					) : (
						<CheckIcon className="size-2.5" aria-hidden="true" />
					)}
					Answer
				</Button>
				<Button
					size="sm"
					variant="ghost"
					onClick={() => void run("dismiss")}
					disabled={submitting !== null}
					className="h-6 gap-1 rounded-sm px-2 text-[10px] text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
					aria-label="Dismiss this decision"
				>
					{submitting === "dismiss" ? (
						<Loader2Icon className="size-2.5 animate-spin" aria-hidden="true" />
					) : (
						<XIcon className="size-2.5" aria-hidden="true" />
					)}
					Dismiss
				</Button>
			</div>
			{error ? (
				<div className="mt-1 text-[10px] leading-3.5 text-red-500 dark:text-red-400" role="alert">
					⚠ {error}
				</div>
			) : null}
		</div>
	)
}

export function PmAttentionQueue({
	queue,
	onMutated,
}: {
	queue?: Ch5PmAttentionQueue
	onMutated: () => void
}) {
	// Items optimistically removed after a successful answer/dismiss; the
	// poll loop drops them from `queue.open` shortly after.
	const [settledIds, setSettledIds] = useState<ReadonlySet<string>>(new Set())
	const items = visibleAttentionItems(queue, settledIds)

	function handleSettled(id: string) {
		setSettledIds((prev) => new Set(prev).add(id))
		onMutated()
	}

	if (items.length === 0) {
		return (
			<div className="flex h-5 items-center gap-2 border-b border-neutral-300 bg-neutral-100 px-2 text-[9px] uppercase tracking-[0.18em] text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-500">
				<span className="font-medium">needs you</span>
				<span className="normal-case tracking-normal">No decisions waiting</span>
			</div>
		)
	}

	const counts = queue?.counts

	return (
		<div className="flex max-h-[40vh] min-h-0 flex-col border-b border-red-500/40">
			<div className="flex h-5 shrink-0 items-center justify-between border-b border-red-900/30 bg-red-950/20 px-2 text-[9px] font-medium uppercase tracking-[0.18em] text-red-400 dark:bg-red-950/40">
				<span>needs you — {items.length} decision{items.length !== 1 ? "s" : ""}</span>
				{counts ? <span className="font-normal tracking-[0.1em]">p0 {counts.p0} · p1 {counts.p1} · p2 {counts.p2}</span> : null}
			</div>
			<div className="min-h-0 overflow-y-auto bg-red-950/5 dark:bg-red-950/10">
				{items.map((item) => (
					<AttentionItemCard key={item.id} item={item} onSettled={handleSettled} />
				))}
			</div>
		</div>
	)
}
