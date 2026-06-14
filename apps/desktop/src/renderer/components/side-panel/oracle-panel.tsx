import { createOracle, deleteOracle, fetchOracles, fetchTmuxSessions, killTmuxSession, renameOracle, type OracleInfo, type TmuxSessionInfo, spawnPtyOracle, spawnPtyTmux } from "../../services/backend";
import { Button, Input } from "@ch5me/ch5-ui-web";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
	AlertTriangleIcon,
	EyeIcon,
	Loader2Icon,
	PencilIcon,
	PlusIcon,
	RefreshCwIcon,
	SparklesIcon,
	TerminalIcon,
	Trash2Icon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Agent } from "../../lib/types"

interface OraclePanelProps {
	agent: Agent
	className?: string
}

const REFRESH_INTERVAL_MS = 5_000
const HIDDEN_KEY = "elf:oracle-panel:hidden"

function loadHidden(): Set<string> {
	if (typeof localStorage === "undefined") return new Set()
	try {
		return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]"))
	} catch {
		return new Set()
	}
}

function saveHidden(hidden: Set<string>): void {
	if (typeof localStorage === "undefined") return
	localStorage.setItem(HIDDEN_KEY, JSON.stringify([...hidden]))
}

function useOracleRoster() {
	return useQuery({
		queryKey: ["oracle-panel-roster"],
		queryFn: fetchOracles,
		refetchInterval: REFRESH_INTERVAL_MS,
		staleTime: REFRESH_INTERVAL_MS,
	})
}

function useTmuxSessions() {
	return useQuery({
		queryKey: ["oracle-panel-tmux"],
		queryFn: fetchTmuxSessions,
		refetchInterval: REFRESH_INTERVAL_MS,
		staleTime: REFRESH_INTERVAL_MS,
	})
}

function isElectronMode(): boolean {
	return typeof window !== "undefined" && "elf" in window
}

export function OraclePanel({ agent, className }: OraclePanelProps) {
	const queryClient = useQueryClient()
	const roster = useOracleRoster()
	const sessions = useTmuxSessions()
	const [hidden, setHidden] = useState<Set<string>>(() => loadHidden())
	const [createIdentity, setCreateIdentity] = useState("")
	const [createCommand, setCreateCommand] = useState("")
	const [showCreate, setShowCreate] = useState(false)
	const [renameTarget, setRenameTarget] = useState<OracleInfo | null>(null)
	const [renameValue, setRenameValue] = useState("")
	const [confirmDelete, setConfirmDelete] = useState<OracleInfo | null>(null)

	const refresh = useCallback(() => {
		void queryClient.invalidateQueries({ queryKey: ["oracle-panel-roster"] })
		void queryClient.invalidateQueries({ queryKey: ["oracle-panel-tmux"] })
	}, [queryClient])

	const createMutation = useMutation({
		mutationFn: ({ identity, command }: { identity: string; command: string | null }) =>
			createOracle(identity, command),
		onSuccess: (session) => {
			toast.success(`Created oracle ${session}`)
			setCreateIdentity("")
			setCreateCommand("")
			setShowCreate(false)
			refresh()
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to create oracle")
		},
	})

	const renameMutation = useMutation({
		mutationFn: ({ from, to }: { from: string; to: string }) => renameOracle(from, to),
		onSuccess: (next) => {
			toast.success(`Renamed to ${next}`)
			setRenameTarget(null)
			setRenameValue("")
			refresh()
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to rename oracle")
		},
	})

	const deleteMutation = useMutation({
		mutationFn: ({ identity, force }: { identity: string; force: boolean }) =>
			deleteOracle(identity, force),
		onSuccess: () => {
			toast.success("Oracle deleted")
			setConfirmDelete(null)
			refresh()
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to delete oracle")
		},
	})

	const killMutation = useMutation({
		mutationFn: ({ socket, session }: { socket: string; session: string }) =>
			killTmuxSession(socket, session),
		onSuccess: () => {
			toast.success("Tmux session killed")
			refresh()
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to kill tmux session")
		},
	})

	const attachOracle = useCallback(
		async (oracle: OracleInfo) => {
			if (!isElectronMode()) {
				toast.error("Attaching to an oracle needs the desktop runtime")
				return
			}
			try {
				await spawnPtyOracle({
					identity: oracle.identity,
					cols: 120,
					rows: 30,
				})
			} catch (err) {
				toast.error(err instanceof Error ? err.message : "Failed to attach oracle")
			}
		},
		[],
	)

	const attachTmux = useCallback(async (session: TmuxSessionInfo) => {
		if (!isElectronMode()) {
			toast.error("Attaching to a tmux session needs the desktop runtime")
			return
		}
		try {
			await spawnPtyTmux({
				socket: session.socket,
				session: session.name,
				cols: 120,
				rows: 30,
			})
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to attach tmux session")
		}
	}, [])

	const handleSubmitCreate = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!createIdentity.trim()) return
		createMutation.mutate({
			identity: createIdentity.trim(),
			command: createCommand.trim() || null,
		})
	}

	const handleSubmitRename = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!renameTarget || !renameValue.trim()) return
		renameMutation.mutate({ from: renameTarget.identity, to: renameValue.trim() })
	}

	const toggleHidden = (identity: string) => {
		setHidden((current) => {
			const next = new Set(current)
			if (next.has(identity)) next.delete(identity)
			else next.add(identity)
			saveHidden(next)
			return next
		})
	}

	const isLoading = roster.isLoading || sessions.isLoading
	const isError = roster.isError || sessions.isError
	const errorMessage = (roster.error ?? sessions.error) instanceof Error
		? ((roster.error ?? sessions.error) as Error).message
		: "Failed to load oracle roster"
	const oracles = roster.data ?? []
	const visibleOracles = useMemo(
		() => oracles.filter((oracle) => !hidden.has(oracle.identity)),
		[oracles, hidden],
	)
	const hiddenCount = oracles.length - visibleOracles.length
	const otherSessions = useMemo(
		() => (sessions.data ?? []).filter((session) => !session.isOracle),
		[sessions.data],
	)

	useEffect(() => {
		if (renameTarget) {
			setRenameValue(renameTarget.identity)
		}
	}, [renameTarget])

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<SparklesIcon className="size-4 text-foreground" aria-hidden="true" />
							<h3 className="text-sm font-medium text-foreground">Oracle Roster</h3>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Live tmux oracle sessions and any other attachable panes for {agent.project}.
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button type="button" variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
							{isLoading ? (
								<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
							) : (
								<RefreshCwIcon className="size-4" aria-hidden="true" />
							)}
							Refresh
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setShowCreate((value) => !value)}
						>
							<PlusIcon className="size-4" aria-hidden="true" />
							New oracle
						</Button>
					</div>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				{showCreate ? (
					<form
						className="space-y-2 rounded-lg border border-border bg-muted/10 p-3"
						onSubmit={handleSubmitCreate}
					>
						<div className="text-xs font-medium text-foreground">Create oracle</div>
						<Input
							value={createIdentity}
							onChange={(event) => setCreateIdentity(event.target.value)}
							placeholder="identity (lowercase, dashes ok)"
							className="h-8"
							autoFocus
						/>
						<Input
							value={createCommand}
							onChange={(event) => setCreateCommand(event.target.value)}
							placeholder="optional startup command (e.g. claude)"
							className="h-8"
						/>
						<div className="flex items-center justify-end gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => {
									setShowCreate(false)
									setCreateIdentity("")
									setCreateCommand("")
								}}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								variant="outline"
								size="sm"
								disabled={!createIdentity.trim() || createMutation.isPending}
							>
								{createMutation.isPending ? "Creating..." : "Create"}
							</Button>
						</div>
					</form>
				) : null}
				{isError ? (
					<div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
						<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<div>
							<div className="font-medium">Couldn't read oracle roster</div>
							<div className="mt-0.5 opacity-80">{errorMessage}</div>
						</div>
					</div>
				) : null}
				<section className="space-y-2">
					<div className="flex items-center justify-between">
						<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Oracles
						</h4>
						{hiddenCount > 0 ? (
							<span className="text-[11px] text-muted-foreground">
								{hiddenCount} hidden · click the eye icon to unhide
							</span>
						) : null}
					</div>
					{isLoading && oracles.length === 0 ? (
						<div className="text-xs text-muted-foreground">Loading oracles...</div>
					) : visibleOracles.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-4 text-center text-xs text-muted-foreground">
							{oracles.length === 0
								? "No oracle sessions running. Click 'New oracle' to start one, or start tmux manually and refresh."
								: "All oracles hidden."}
						</div>
					) : (
						<div className="space-y-2">
							{visibleOracles.map((oracle) => (
								<OracleRow
									key={oracle.session}
									oracle={oracle}
									onAttach={() => void attachOracle(oracle)}
									onRename={() => setRenameTarget(oracle)}
									onDelete={() => setConfirmDelete(oracle)}
									attaching={false}
									isMaster={oracle.isMaster}
									renaming={renameMutation.isPending && renameTarget?.identity === oracle.identity}
									deleting={deleteMutation.isPending && confirmDelete?.identity === oracle.identity}
								/>
							))}
						</div>
					)}
				</section>
				<section className="space-y-2">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Other tmux sessions
					</h4>
					{sessions.isLoading && otherSessions.length === 0 ? (
						<div className="text-xs text-muted-foreground">Loading tmux sessions...</div>
					) : otherSessions.length === 0 ? (
						<div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-3 text-xs text-muted-foreground">
							No standalone tmux sessions to attach. Oracles above are listed separately.
						</div>
					) : (
						<div className="space-y-2">
							{otherSessions.map((session) => (
								<div
									key={`${session.socket}::${session.name}`}
									className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/10 px-3 py-2"
								>
									<div className="min-w-0 flex-1">
										<div className="truncate text-xs font-medium text-foreground">
											{session.name}
										</div>
										<div className="mt-0.5 text-[10px] text-muted-foreground">
											{session.socket} · {session.windows} window{session.windows === 1 ? "" : "s"}
											{session.attached ? " · attached" : ""}
										</div>
									</div>
									<div className="flex items-center gap-1.5">
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => void attachTmux(session)}
										>
											<TerminalIcon className="size-3.5" aria-hidden="true" />
											Attach
										</Button>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() =>
												killMutation.mutate({ socket: session.socket, session: session.name })
											}
											disabled={killMutation.isPending}
										>
											<Trash2Icon className="size-3.5" aria-hidden="true" />
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</section>
				{hidden.size > 0 ? (
					<section className="space-y-2">
						<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							Hidden
						</h4>
						<div className="space-y-1.5">
							{[...hidden].map((identity) => (
								<div
									key={identity}
									className="flex items-center justify-between gap-2 rounded-md border border-dashed border-border bg-muted/10 px-3 py-1.5"
								>
									<span className="text-xs text-muted-foreground">{identity}</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => toggleHidden(identity)}
									>
										<EyeIcon className="size-3.5" aria-hidden="true" />
										Unhide
									</Button>
								</div>
							))}
						</div>
					</section>
				) : null}
			</div>
			{renameTarget ? (
				<div className="border-t border-border bg-background px-4 py-3">
					<form
						className="flex items-center gap-2"
						onSubmit={handleSubmitRename}
					>
						<Input
							value={renameValue}
							onChange={(event) => setRenameValue(event.target.value)}
							placeholder="new identity"
							className="h-8 flex-1"
							autoFocus
						/>
						<Button
							type="submit"
							variant="outline"
							size="sm"
							disabled={!renameValue.trim() || renameMutation.isPending}
						>
							{renameMutation.isPending ? "Renaming..." : "Rename"}
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								setRenameTarget(null)
								setRenameValue("")
							}}
						>
							Cancel
						</Button>
					</form>
				</div>
			) : null}
			{confirmDelete ? (
				<div className="border-t border-destructive/40 bg-destructive/5 px-4 py-3 text-xs text-destructive">
					<div className="font-medium">
						Delete oracle {confirmDelete.session}
						{confirmDelete.isMaster ? " (master)" : ""}?
					</div>
					<div className="mt-1 opacity-80">
						This kills the tmux session. Cannot be undone.
					</div>
					<div className="mt-3 flex items-center justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => setConfirmDelete(null)}
						>
							Cancel
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							disabled={deleteMutation.isPending}
							onClick={() =>
								deleteMutation.mutate({
									identity: confirmDelete.identity,
									force: confirmDelete.isMaster,
								})
							}
						>
							{deleteMutation.isPending ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</div>
			) : null}
		</div>
	)
}

interface OracleRowProps {
	oracle: OracleInfo
	onAttach: () => void
	onRename: () => void
	onDelete: () => void
	attaching: boolean
	renaming: boolean
	deleting: boolean
	isMaster: boolean
}

function OracleRow({ oracle, onAttach, onRename, onDelete, renaming, deleting }: OracleRowProps) {
	return (
		<div className="rounded-md border border-border bg-muted/10 px-3 py-2">
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<div className="truncate text-sm font-medium text-foreground">
							{oracle.displayName}
						</div>
						{oracle.isMaster ? (
							<span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
								Master
							</span>
						) : null}
					</div>
					<div className="mt-1 text-[10px] text-muted-foreground">
						{oracle.session} · {oracle.socket}
						{oracle.attached ? " · attached" : ""}
					</div>
				</div>
				<div className="flex items-center gap-1.5">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onAttach}
						disabled={renaming || deleting}
					>
						<TerminalIcon className="size-3.5" aria-hidden="true" />
						Attach
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onRename}
						disabled={renaming || deleting}
					>
						<PencilIcon className="size-3.5" aria-hidden="true" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onDelete}
						disabled={deleting}
					>
						<Trash2Icon className="size-3.5" aria-hidden="true" />
					</Button>
				</div>
			</div>
		</div>
	)
}

export function OracleEmptyState() {
	return (
		<div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-3 text-center text-xs text-muted-foreground">
			Oracle roster is empty. No tmux sessions are running on the configured socket.
		</div>
	)
}
