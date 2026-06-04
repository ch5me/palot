import { execFile } from "node:child_process"
import { existsSync } from "node:fs"
import { promisify } from "node:util"
import { createLogger } from "./logger"

const log = createLogger("oracles")

const execFileAsync = promisify(execFile)

export interface OracleInfo {
	identity: string
	session: string
	socket: string
	displayName: string
	attached: boolean
	isMaster: boolean
	running: boolean
}

export interface TmuxSessionInfo {
	socket: string
	name: string
	attached: boolean
	windows: number
	isOracle: boolean
}

const ORACLE_SOCKET = process.env.AIOS_ORACLE_SOCKET?.trim() || "adletic"
const PRIMARY_ORACLE_IDENTITY = process.env.AIOS_PRIMARY_ORACLE?.trim() || "firaz"
const TMUX_BIN_CANDIDATES = ["/opt/homebrew/bin/tmux", "/usr/local/bin/tmux", "/usr/bin/tmux"]

function tmuxBin(): string {
	return TMUX_BIN_CANDIDATES.find((candidate) => existsSync(candidate)) ?? "tmux"
}

function sanitizeIdentity(identity: string): string {
	return identity
		.trim()
		.toLowerCase()
		.split("")
		.filter((char) => /[a-z0-9_-]/.test(char))
		.join("")
}

async function runTmux(socket: string, args: string[]): Promise<string> {
	const fullArgs = ["-L", socket, ...args]
	const { stdout } = await execFileAsync(tmuxBin(), fullArgs)
	return stdout
}

async function tryRunTmux(socket: string, args: string[]): Promise<string | null> {
	try {
		return await runTmux(socket, args)
	} catch (err) {
		const error = err as NodeJS.ErrnoException & { stderr?: string; code?: string }
		if (error.code === "ENOENT") {
			log.warn("tmux binary not found on PATH", { tmuxBin: tmuxBin() })
			return null
		}
		if (error.stderr?.includes("no server running") || error.stderr?.includes("failed to connect")) {
			return null
		}
		log.debug("tmux call failed", { socket, args: args[0], code: error.code, stderr: error.stderr })
		return null
	}
}

function displayNameFor(identity: string, session: string): string {
	void session
	return identity
		.replace(/[-_]+/g, " ")
		.replace(/\b\w/g, (char) => char.toUpperCase())
}

export async function listOracles(): Promise<OracleInfo[]> {
	const stdout = await tryRunTmux(ORACLE_SOCKET, [
		"list-sessions",
		"-F",
		"#{session_name}|#{session_attached}",
	])
	if (!stdout) {
		return []
	}
	const rows = stdout
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [session, attachedRaw] = line.split("|")
			return { session, attached: attachedRaw?.trim() !== "0" }
		})
		.filter(({ session }) => session.startsWith("aios-") && !session.startsWith("aios-term-"))
		.map(({ session, attached }) => {
			const identity = session.replace(/^aios-/, "")
			return {
				identity,
				session,
				socket: ORACLE_SOCKET,
				displayName: displayNameFor(identity, session),
				attached,
				isMaster: identity === PRIMARY_ORACLE_IDENTITY,
				running: true,
			}
		})
	rows.sort(
		(a, b) =>
			Number(b.isMaster) - Number(a.isMaster) ||
			Number(b.attached) - Number(a.attached) ||
			a.identity.localeCompare(b.identity),
	)
	return rows
}

export async function listTmuxSessions(): Promise<TmuxSessionInfo[]> {
	const stdout = await tryRunTmux(ORACLE_SOCKET, [
		"list-sessions",
		"-F",
		"#{session_name}|#{session_attached}|#{session_windows}",
	])
	if (!stdout) {
		return []
	}
	return stdout
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [name, attachedRaw, windowsRaw] = line.split("|")
			return {
				socket: ORACLE_SOCKET,
				name,
				attached: attachedRaw?.trim() !== "0",
				windows: Number.parseInt(windowsRaw ?? "1", 10) || 1,
				isOracle: name.startsWith("aios-"),
			}
		})
}

export async function createOracle(identity: string, command?: string | null): Promise<string> {
	const sanitized = sanitizeIdentity(identity)
	if (!sanitized) {
		throw new Error("identity must contain letters or digits")
	}
	const session = `aios-${sanitized}`
	await runTmux(ORACLE_SOCKET, ["new-session", "-d", "-s", session])
	if (command?.trim()) {
		await runTmux(ORACLE_SOCKET, ["send-keys", "-t", session, command.trim(), "Enter"])
	}
	return session
}

export async function renameOracle(from: string, to: string): Promise<string> {
	const fromId = sanitizeIdentity(from)
	const toId = sanitizeIdentity(to)
	if (!fromId || !toId) {
		throw new Error("new name must contain letters or digits")
	}
	const nextSession = `aios-${toId}`
	await runTmux(ORACLE_SOCKET, ["rename-session", "-t", `aios-${fromId}`, nextSession])
	return nextSession
}

export async function deleteOracle(identity: string, force = false): Promise<void> {
	const sanitized = sanitizeIdentity(identity)
	if (!sanitized) {
		throw new Error("identity must contain letters or digits")
	}
	if (sanitized === PRIMARY_ORACLE_IDENTITY && !force) {
		throw new Error(`deleting aios-${sanitized} breaks your whatsapp routing — confirm with force`)
	}
	const session = `aios-${sanitized}`
	try {
		await runTmux(ORACLE_SOCKET, ["kill-session", "-t", session])
	} catch (err) {
		const error = err as NodeJS.ErrnoException & { stderr?: string }
		if (error.stderr?.includes("can't find session")) {
			return
		}
		throw err
	}
}

export async function killTmuxSession(socket: string, session: string): Promise<void> {
	if (!socket.trim() || !session.trim()) {
		throw new Error("socket and session are required")
	}
	const trimmedSocket = socket.trim()
	const trimmedSession = session.trim()
	try {
		await runTmux(trimmedSocket, ["kill-session", "-t", trimmedSession])
	} catch (err) {
		const error = err as NodeJS.ErrnoException & { stderr?: string }
		if (error.stderr?.includes("can't find session")) {
			return
		}
		throw err
	}
}

export async function appshot(identity?: string | null): Promise<string> {
	const path = `/tmp/elf-shot-${Date.now()}.png`
	await execFileAsync("/usr/sbin/screencapture", ["-x", path])
	const target = sanitizeIdentity(identity ?? "")
	if (target) {
		await runTmux(ORACLE_SOCKET, ["send-keys", "-t", `aios-${target}`, "-l", `${path} `])
	}
	return path
}
