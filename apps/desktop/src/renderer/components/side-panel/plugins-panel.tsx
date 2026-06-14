import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
	AlertTriangleIcon,
	Loader2Icon,
	PlugIcon,
	RefreshCwIcon,
	SparklesIcon,
	TerminalSquareIcon,
} from "lucide-react"
import { useMemo } from "react"
import type { Agent } from "../../lib/types"
import { getProjectClient } from "../../services/connection-manager"
import { listMcpConnectionRecords } from "../../services/backend"

interface PluginsPanelProps {
	agent: Agent
	className?: string
}

interface SkillEntry {
	name: string
	description?: string
}

function useSkills(directory: string) {
	return useQuery({
		queryKey: ["plugins-surface-skills", directory],
		queryFn: async (): Promise<SkillEntry[]> => {
			const client = getProjectClient(directory)
			if (!client) return []
			const result = await client.app.skills()
			const data = (result.data ?? []) as Array<{ name: string; description?: string }>
			return data
		},
	})
}

function useCommands(directory: string) {
	return useQuery({
		queryKey: ["plugins-surface-commands", directory],
		queryFn: async (): Promise<SkillEntry[]> => {
			const client = getProjectClient(directory)
			if (!client) return []
			const result = await client.command.list()
			const data = (result.data ?? []) as Array<{ name: string; description?: string }>
			return data
		},
	})
}

function useMcpRecords() {
	return useQuery({
		queryKey: ["plugins-surface-mcp-records"],
		queryFn: async () => {
			return await listMcpConnectionRecords()
		},
	})
}

function extractMcpServers(
	records: Array<{
		name: string
		transport: string
		authState?: string
		testState?: string
		status?: string
		runtimeState?: string
		lastHealthyAt?: string | null
		canonicalStore?: string
		ownershipMode?: string
	}>,
): Array<{
	name: string
	status: string
	posture: string
	hydrated: string
	canonicalStore: string
	ownershipMode: string
}> {
	return records.map((record) => {
		const status =
			record.status ??
			(record.testState === "failing" ? "degraded" : record.authState === "failed" ? "needs_auth" : "ready")
		const hydrated =
			record.runtimeState === "active" || record.lastHealthyAt
				? "active"
				: record.runtimeState === "projected"
					? "projected"
					: "inactive"
		return {
			name: record.name,
			status,
			posture: record.authState === "authenticated" ? "connected" : "configured",
			hydrated,
			canonicalStore: record.canonicalStore ?? "local",
			ownershipMode: record.ownershipMode ?? "local-only",
		}
	})
}

export function PluginsPanel({ agent, className }: PluginsPanelProps) {
	const queryClient = useQueryClient()
	const skills = useSkills(agent.directory)
	const commands = useCommands(agent.directory)
	const mcpQuery = useMcpRecords()
	const clientReachable = Boolean(getProjectClient(agent.directory))

	const refresh = () => {
		void queryClient.invalidateQueries({ queryKey: ["plugins-surface-skills", agent.directory] })
		void queryClient.invalidateQueries({ queryKey: ["plugins-surface-commands", agent.directory] })
		void queryClient.invalidateQueries({ queryKey: ["plugins-surface-mcp-records"] })
	}

	const mcpServers = useMemo(() => extractMcpServers(mcpQuery.data ?? []), [mcpQuery.data])

	const summary = useMemo(() => {
		const activeCount = mcpServers.filter((server) => server.hydrated === "active").length
		const gatewayCount = mcpServers.filter((server) => server.canonicalStore === "gateway").length
		return [
			`${skills.data?.length ?? 0} skills`,
			`${commands.data?.length ?? 0} commands`,
			`${mcpServers.length} MCP servers`,
			`${activeCount} active`,
			`${gatewayCount} gateway-owned`,
			clientReachable ? "opencode reachable" : "opencode not reachable",
		].join(" · ")
	}, [skills.data?.length, commands.data?.length, mcpServers, clientReachable])

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<div className="flex items-center gap-2">
							<PlugIcon className="size-4 text-foreground" aria-hidden="true" />
							<h3 className="text-sm font-medium text-foreground">Plugins</h3>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							OpenCode-native integrations for {agent.project}: skills, commands, MCP servers.
						</p>
					</div>
					<Button onClick={refresh} variant="outline" size="sm" type="button">
						<RefreshCwIcon className="size-4" aria-hidden="true" />
						Refresh
					</Button>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<div className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
					{summary}
				</div>
				{!clientReachable ? (
					<div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
						<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
						<div>
							No active OpenCode client for this session. Start the server or attach to one
							to populate skills, commands, and MCP posture.
						</div>
					</div>
				) : null}
				<section className="space-y-2">
					<h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						<SparklesIcon className="size-3" aria-hidden="true" />
						Skills
					</h4>
					{skills.isLoading ? (
						<Loading text="Loading skills..." />
					) : skills.isError ? (
						<ErrorMessage error={skills.error} />
					) : (skills.data?.length ?? 0) > 0 ? (
						<div className="space-y-1">
							{skills.data?.slice(0, 32).map((skill) => (
								<div key={skill.name} className="rounded-md border border-border px-3 py-2">
									<div className="text-xs font-medium text-foreground">{skill.name}</div>
									{skill.description ? (
										<div className="mt-1 text-xs text-muted-foreground">{skill.description}</div>
									) : null}
								</div>
							))}
							{(skills.data?.length ?? 0) > 32 ? (
								<div className="text-[10px] text-muted-foreground">
									Showing first 32 of {skills.data?.length}
								</div>
							) : null}
						</div>
					) : (
						<Empty text="No skills available from the current connection." />
					)}
				</section>
				<section className="space-y-2">
					<h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						<TerminalSquareIcon className="size-3" aria-hidden="true" />
						Commands
					</h4>
					{commands.isLoading ? (
						<Loading text="Loading commands..." />
					) : commands.isError ? (
						<ErrorMessage error={commands.error} />
					) : (commands.data?.length ?? 0) > 0 ? (
						<div className="space-y-1">
							{commands.data?.slice(0, 32).map((command) => (
								<div key={command.name} className="rounded-md border border-border px-3 py-2">
									<div className="text-xs font-medium text-foreground">/{command.name}</div>
									{command.description ? (
										<div className="mt-1 text-xs text-muted-foreground">{command.description}</div>
									) : null}
								</div>
							))}
							{(commands.data?.length ?? 0) > 32 ? (
								<div className="text-[10px] text-muted-foreground">
									Showing first 32 of {commands.data?.length}
								</div>
							) : null}
						</div>
					) : (
						<Empty text="No commands available from the current connection." />
					)}
				</section>
				<section className="space-y-2">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						MCP servers
					</h4>
					{mcpQuery.isLoading ? (
						<Loading text="Loading MCP posture..." />
					) : mcpQuery.isError ? (
						<ErrorMessage error={mcpQuery.error} />
					) : mcpServers.length > 0 ? (
						<div className="space-y-1">
							{mcpServers.map((server) => (
								<div
									key={server.name}
									className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/10 px-3 py-2"
								>
									<div className="space-y-1">
										<span className="font-mono text-xs text-foreground">{server.name}</span>
										<div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
											<span>{server.posture}</span>
											<span>•</span>
											<span>{server.hydrated}</span>
											<span>•</span>
											<span>{server.ownershipMode}</span>
											<span>•</span>
											<span>{server.canonicalStore}</span>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<span
											className={
												server.status === "connected"
													? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
													: "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300"
											}
										>
											{server.status}
										</span>
									</div>
								</div>
							))}
						</div>
					) : (
						<div className="rounded-md border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
							No MCP servers in the current OpenCode config. Add providers under
							<code className="ml-1 rounded bg-muted/40 px-1 py-0.5 font-mono">provider.mcp</code>
							to surface them here.
						</div>
					)}
				</section>
			</div>
		</div>
	)
}

import { Button } from "@ch5me/ch5-ui-web"

function Loading({ text }: { text: string }) {
	return (
		<div className="flex items-center gap-2 text-xs text-muted-foreground">
			<Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
			{text}
		</div>
	)
}

function Empty({ text }: { text: string }) {
	return (
		<div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
			{text}
		</div>
	)
}

function ErrorMessage({ error }: { error: unknown }) {
	const message = error instanceof Error ? error.message : "Failed to load"
	return (
		<div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
			<AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
			<span>{message}</span>
		</div>
	)
}
