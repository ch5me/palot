import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@ch5me/elf-ui/components/button"
import {
	AlertTriangleIcon,
	ArrowDownToLineIcon,
	BookTextIcon,
	BotIcon,
	BriefcaseIcon,
	HashIcon,
	Loader2Icon,
	RefreshCwIcon,
	SettingsIcon,
	SparklesIcon,
	TerminalSquareIcon,
	UsersIcon,
	WorkflowIcon,
} from "lucide-react"
import { toast } from "sonner"
import type { Agent } from "../../lib/types"
import {
	fetchProviderDetections,
	restoreMigrationBackup,
} from "../../services/backend"
import { isElectron } from "../../services/backend"

interface ClaudePanelProps {
	agent: Agent
	className?: string
}

const CATEGORY_LABELS: Record<string, string> = {
	mcpServers: "MCP servers",
	agents: "Agents",
	commands: "Commands",
	rules: "Rules (CLAUDE.md / AGENTS.md)",
	skills: "Skills",
	projects: "Projects",
	globalSettings: "Global settings",
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
	mcpServers: "Connector definitions that plug into chat tools",
	agents: "Custom agent personas / roles",
	commands: "Slash commands",
	rules: "Project + global memory files translated to AGENTS.md",
	skills: "Reusable prompts and procedural notes",
	projects: "Project history and past sessions",
	globalSettings: "Provider, theme, and other config",
}

function useClaudeDetection() {
	return useQuery({
		queryKey: ["claude-panel-detection"],
		queryFn: fetchProviderDetections,
		select: (detections) => detections.find((entry) => entry.provider === "claude-code") ?? null,
		staleTime: 30_000,
	})
}

function getRuntimeAvailable(): boolean {
	return isElectron
}

export function ClaudePanel({ agent, className }: ClaudePanelProps) {
	const queryClient = useQueryClient()
	const detection = useClaudeDetection()
	const restoreMutation = useMutation({
		mutationFn: restoreMigrationBackup,
		onSuccess: (result) => {
			if (result.success) {
				toast.success(
					`Restored ${result.restored.length} file${result.restored.length === 1 ? "" : "s"} from migration backup`,
				)
			} else if (result.errors.length > 0) {
				toast.error(`Restore had ${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`)
			} else {
				toast.message("Restore completed with no changes")
			}
			void queryClient.invalidateQueries({ queryKey: ["claude-panel-detection"] })
		},
		onError: (err) => {
			toast.error(err instanceof Error ? err.message : "Failed to restore migration backup")
		},
	})

	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: ["claude-panel-detection"] })
	}

	const detected = detection.data
	const found = detected?.found ?? false
	const counts: Array<{ key: string; value: number; icon: typeof BotIcon }> = [
		{ key: "mcpServers", value: detected?.mcpServerCount ?? 0, icon: WorkflowIcon },
		{ key: "agents", value: detected?.agentCount ?? 0, icon: BotIcon },
		{ key: "commands", value: detected?.commandCount ?? 0, icon: HashIcon },
		{ key: "rules", value: detected?.ruleCount ?? 0, icon: BookTextIcon },
		{ key: "skills", value: detected?.skillCount ?? 0, icon: SparklesIcon },
		{ key: "projects", value: detected?.projectCount ?? 0, icon: BriefcaseIcon },
	]
	const runtimeAvailable = getRuntimeAvailable()

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h3 className="text-sm font-medium text-foreground">Claude Code</h3>
						<p className="mt-1 text-xs text-muted-foreground">
							Migration + compatibility lane for teams coming from Claude Code into{" "}
							{agent.project}.
						</p>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={refresh}
						disabled={detection.isLoading}
					>
						{detection.isLoading ? (
							<Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<RefreshCwIcon className="size-4" aria-hidden="true" />
						)}
						Refresh
					</Button>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				{detection.isError ? (
					<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
						<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<div>
							<div className="font-medium">Couldn't run Claude Code detection</div>
							<div className="mt-0.5 opacity-80">
								{detection.error instanceof Error
									? detection.error.message
									: "Onboarding detection failed."}
							</div>
						</div>
					</div>
				) : null}
				<section className="rounded-lg border border-border bg-muted/10 p-3">
					<div className="flex items-center justify-between gap-2">
						<div>
							<div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
								Detection
							</div>
							<div className="mt-1 text-sm font-medium text-foreground">
								{found ? "Claude Code detected" : "Claude Code not detected"}
							</div>
							<div className="mt-1 text-xs text-muted-foreground">
								{detected?.summary ?? "Run detection to see what's installed on this machine."}
							</div>
						</div>
						<span
							className={
								found
									? "rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
									: "rounded-full bg-amber-500/15 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300"
							}
						>
							{found ? "Found" : "Missing"}
						</span>
					</div>
				</section>
				<section className="space-y-2">
					<div className="flex items-center justify-between">
						<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
							What gets imported
						</h4>
						{detected?.hasGlobalSettings ? (
							<span className="text-[10px] text-muted-foreground">
								Global settings present
							</span>
						) : null}
					</div>
					<div className="grid grid-cols-2 gap-2 md:grid-cols-3">
						{counts.map(({ key, value, icon: Icon }) => (
							<div
								key={key}
								className="flex items-center gap-2 rounded-md border border-border bg-muted/10 px-2.5 py-2"
							>
								<Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
								<div className="min-w-0 flex-1">
									<div className="text-[10px] uppercase tracking-wide text-muted-foreground">
										{CATEGORY_LABELS[key]}
									</div>
									<div className="text-sm font-semibold text-foreground">{value}</div>
								</div>
							</div>
						))}
					</div>
					<div className="rounded-md border border-dashed border-border bg-muted/5 px-3 py-2 text-xs text-muted-foreground">
						<p className="font-medium text-foreground">How the import works</p>
						<ul className="mt-1 list-disc space-y-0.5 pl-4">
							{Object.entries(CATEGORY_DESCRIPTIONS).map(([key, description]) => (
								<li key={key}>{description}</li>
							))}
						</ul>
					</div>
				</section>
				<section className="rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
					<div className="flex items-center gap-2 text-foreground">
						<UsersIcon className="size-3.5" aria-hidden="true" />
						<span className="font-medium">How to rerun the flow</span>
					</div>
					<p className="mt-2">
						The Claude Code import + migration wizard lives in the Settings surface. The
						sidebar entry "Settings → Migration" walks you through the same detection,
						preview, execute, and restore-backup steps.
					</p>
					{runtimeAvailable ? (
						<div className="mt-3 flex items-center justify-between gap-2">
							<div className="flex items-center gap-2 text-foreground">
								<ArrowDownToLineIcon className="size-3.5" aria-hidden="true" />
								<span>Restore the most recent migration backup (if you have one).</span>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={restoreMutation.isPending}
								onClick={() => {
									if (window.confirm("Restore the most recent migration backup?")) {
										restoreMutation.mutate()
									}
								}}
							>
								{restoreMutation.isPending ? "Restoring..." : "Restore backup"}
							</Button>
						</div>
					) : null}
				</section>
				<section className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
					<div className="flex items-center gap-2 text-foreground">
						<TerminalSquareIcon className="size-3.5" aria-hidden="true" />
						<span className="font-medium">Compatibility boundary</span>
					</div>
					<p className="mt-1.5 leading-relaxed">
						Elf does not embed a live Claude Code runtime. OpenCode stays the only
						interactive coding lane. This surface is a compatibility + import boundary:
						import your existing Claude Code config (mcp servers, agents, commands,
						rules, skills) into Elf, and rerun the wizard any time from Settings.
					</p>
				</section>
				<section className="rounded-md border border-border bg-muted/5 px-3 py-2 text-xs text-muted-foreground">
					<div className="flex items-center gap-2 text-foreground">
						<SettingsIcon className="size-3.5" aria-hidden="true" />
						<span>
							This surface reflects real onboarding state. It does not run Claude
							Code or embed a second runtime.
						</span>
					</div>
				</section>
			</div>
		</div>
	)
}
