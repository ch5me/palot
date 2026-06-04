import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import type { Agent } from "../../lib/types"
import { getProjectClient } from "../../services/connection-manager"

interface PluginsPanelProps {
	agent: Agent
	className?: string
}

function useSkills(directory: string) {
	return useQuery({
		queryKey: ["plugins-surface-skills", directory],
		queryFn: async () => {
			const client = getProjectClient(directory)
			if (!client) return [] as Array<{ name: string; description?: string }>
			const result = await client.app.skills()
			return (result.data ?? []) as Array<{ name: string; description?: string }>
		},
	})
}

function useCommands(directory: string) {
	return useQuery({
		queryKey: ["plugins-surface-commands", directory],
		queryFn: async () => {
			const client = getProjectClient(directory)
			if (!client) return [] as Array<{ name: string; description?: string }>
			const result = await client.command.list()
			return (result.data ?? []) as Array<{ name: string; description?: string }>
		},
	})
}

export function PluginsPanel({ agent, className }: PluginsPanelProps) {
	const skills = useSkills(agent.directory)
	const commands = useCommands(agent.directory)

	const summary = useMemo(() => {
		return [
			`${skills.data?.length ?? 0} skills`,
			`${commands.data?.length ?? 0} commands`,
			"MCPs managed through OpenCode config",
		].join(" · ")
	}, [skills.data?.length, commands.data?.length])

	return (
		<div className={`flex h-full min-h-0 flex-col bg-background ${className ?? ""}`}>
			<div className="border-b border-border px-4 py-3">
				<h3 className="text-sm font-medium text-foreground">Plugins</h3>
				<p className="mt-1 text-xs text-muted-foreground">
					OpenCode-native integrations surface: skills, commands, and MCP posture.
				</p>
			</div>
			<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 py-4">
				<div className="rounded-lg border border-border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
					{summary}
				</div>
				<section className="space-y-2">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Skills</h4>
					{skills.isLoading ? (
						<div className="text-xs text-muted-foreground">Loading skills...</div>
					) : skills.data && skills.data.length > 0 ? (
						<div className="space-y-1">
							{skills.data.slice(0, 12).map((skill) => (
								<div key={skill.name} className="rounded-md border border-border px-3 py-2">
									<div className="text-xs font-medium text-foreground">{skill.name}</div>
									{skill.description && (
										<div className="mt-1 text-xs text-muted-foreground">{skill.description}</div>
									)}
								</div>
							))}
						</div>
					) : (
						<div className="text-xs text-muted-foreground">No skills available from the current connection.</div>
					)}
				</section>
				<section className="space-y-2">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commands</h4>
					{commands.isLoading ? (
						<div className="text-xs text-muted-foreground">Loading commands...</div>
					) : commands.data && commands.data.length > 0 ? (
						<div className="space-y-1">
							{commands.data.slice(0, 12).map((command) => (
								<div key={command.name} className="rounded-md border border-border px-3 py-2">
									<div className="text-xs font-medium text-foreground">/{command.name}</div>
									{command.description && (
										<div className="mt-1 text-xs text-muted-foreground">{command.description}</div>
									)}
								</div>
							))}
						</div>
					) : (
						<div className="text-xs text-muted-foreground">No commands available from the current connection.</div>
					)}
				</section>
				<section className="space-y-2">
					<h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MCP posture</h4>
					<div className="rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
						MCP servers and provider plugin auth are currently managed through OpenCode config and provider settings.
					</div>
				</section>
			</div>
		</div>
	)
}
