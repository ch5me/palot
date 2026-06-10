import path from "node:path"

export function resolveProjectMcporterConfigPath() {
	return (
		process.env.ELF_MCP_PROJECT_CONFIG_PATH ?? path.join(process.cwd(), "config", "mcporter.json")
	)
}

export function resolveHomeMcporterConfigPath() {
	return (
		process.env.ELF_MCP_HOME_CONFIG_PATH ??
		path.join(process.env.HOME ?? ".", ".mcporter", "mcporter.json")
	)
}

export function resolveMcporterConfigPath(scope: string) {
	return scope === "home" ? resolveHomeMcporterConfigPath() : resolveProjectMcporterConfigPath()
}

export function withMcporterConfig(args: string[], configPath: string) {
	return ["--config", configPath, ...args]
}
