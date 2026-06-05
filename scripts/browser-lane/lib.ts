import { spawn } from "node:child_process"

export interface BrowserLaneAuth {
	user: string
	password: string
}

export function encodeBrowserLaneAuth(auth: BrowserLaneAuth): string {
	return `Basic ${Buffer.from(`${auth.user}:${auth.password}`).toString("base64")}`
}

export interface BrowserLaneCliArgs {
	lane: string
	mode: "local" | "remote"
	host: string | null
	ssh: string | null
	streamBackendUrl: string | null
	cdpEndpoint: string | null
	profilePath: string | null
	streamUser: string | null
	streamPassword: string | null
}

export function readBrowserLaneAuthFromEnv(env: Record<string, string>): BrowserLaneAuth | null {
	const user = env.STREAM_AUTH_USER
	const password = env.STREAM_AUTH_PASSWORD
	if (!user || !password) return null
	return { user, password }
}

export function parseBrowserLaneArgs(argv: string[]): BrowserLaneCliArgs {
	const values: Record<string, string> = {}
	for (let index = 0; index < argv.length; index++) {
		const part = argv[index]
		if (!part.startsWith("--")) continue
		values[part.slice(2)] =
			argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true"
	}
	return {
		lane: values.lane || "default",
		mode: values.mode === "remote" ? "remote" : "local",
		host: values.host || null,
		ssh: values.ssh || null,
		streamBackendUrl: values["stream-backend-url"] || null,
		cdpEndpoint: values["cdp-endpoint"] || null,
		profilePath: values["profile-path"] || null,
		streamUser: values["stream-user"] || null,
		streamPassword: values["stream-password"] || null,
	}
}

export async function runCommand(
	command: string,
	args: string[],
	options: { cwd?: string; capture?: boolean } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
	const proc = spawn(command, args, {
		cwd: options.cwd,
		env: process.env,
		stdio: options.capture ? "pipe" : "inherit",
	})
	let stdout = ""
	let stderr = ""
	if (options.capture) {
		proc.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString()
		})
		proc.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString()
		})
	}
	const code: number = await new Promise((resolve) => {
		proc.on("exit", (value) => resolve(value ?? 1))
	})
	return { code, stdout, stderr }
}

export async function runRemoteCommand(
	target: string,
	script: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
	return await runCommand("ssh", [target, script], { capture: true })
}
