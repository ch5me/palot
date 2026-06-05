import { execFile } from "node:child_process"
import type { BrowserLaneCapabilityReport } from "../preload/api"

export async function tryExec(command: string, args: string[]): Promise<string | null> {
	return await new Promise((resolve) => {
		execFile(command, args, { timeout: 5000, env: process.env }, (error, stdout) => {
			if (error) {
				resolve(null)
				return
			}
			resolve(stdout.trim() || null)
		})
	})
}

export async function detectBrowserLaneCapabilities(
	exec: typeof tryExec = tryExec,
): Promise<BrowserLaneCapabilityReport> {
	const platform = process.platform
	const dockerVersion = await exec("docker", ["--version"])
	const dockerInstalled = dockerVersion !== null

	const dockerComposeVersion = dockerInstalled
		? await exec("docker", ["compose", "version"])
		: null
	const composeStandaloneVersion = dockerInstalled
		? await exec("docker-compose", ["--version"])
		: null

	const composeCommand = dockerComposeVersion
		? "docker compose"
		: composeStandaloneVersion
			? "docker-compose"
			: null
	const composeVersion = dockerComposeVersion || composeStandaloneVersion
	const composeAvailable = composeCommand !== null
	const localRuntimeSupported = dockerInstalled && composeAvailable
	const remoteAttachSupported = platform !== "win32"

	let unsupportedReason: string | null = null
	let remediation: string | null = null
	if (!dockerInstalled) {
		unsupportedReason = "Docker not installed"
		remediation = "Install Docker Desktop or Docker Engine before starting a local browser lane."
	} else if (!composeAvailable) {
		unsupportedReason = "Docker Compose not available"
		remediation = "Install Compose v2 (`docker compose`) or `docker-compose` for local browser lanes."
	} else if (platform === "win32") {
		unsupportedReason = "Remote attach helpers are not implemented on Windows in MVP"
		remediation = "Use local Docker runtime on Windows, or run remote attach from macOS/Linux host."
	}

	return {
		platform,
		localRuntimeSupported,
		remoteAttachSupported,
		docker: {
			installed: dockerInstalled,
			version: dockerVersion,
		},
		compose: {
			available: composeAvailable,
			command: composeCommand,
			version: composeVersion,
		},
		unsupportedReason,
		remediation,
	}
}
