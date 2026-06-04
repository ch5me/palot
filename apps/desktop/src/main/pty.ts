import { spawn, type IPty } from "node-pty"

export interface PtySpawnRequest {
	cols: number
	rows: number
	cwd?: string | null
}

export interface PtyTerminalSpawnRequest extends PtySpawnRequest {
	name: string
	command?: string | null
}

export interface PtyOracleSpawnRequest extends PtySpawnRequest {
	identity: string
}

export interface PtyTmuxSpawnRequest extends PtySpawnRequest {
	socket: string
	session: string
}

export interface PtyDataEvent {
	id: number
	data: string
}

export interface PtyExitEvent {
	id: number
	exitCode: number
	signal?: number
}

interface PtySession {
	pty: IPty
	onDataDispose: { dispose(): void }
	onExitDispose: { dispose(): void }
}

interface PtyControllerOptions {
	onData?: (event: PtyDataEvent) => void
	onExit?: (event: PtyExitEvent) => void
	spawnPty?: (file: string, args: string[], request: PtySpawnRequest) => IPty
}

const DEFAULT_UNIX_SHELL = "/bin/zsh"
const NAME_PATTERN = /^[A-Za-z0-9._-]+$/

function quoteSh(value: string): string {
	return `'${value.replace(/'/g, `'\\''`)}'`
}

function resolveCwd(cwd?: string | null): string {
	if (cwd?.trim()) {
		return cwd
	}
	return process.env.HOME ?? process.cwd()
}

function resolveShell(): string {
	if (process.platform === "win32") {
		return process.env.COMSPEC ?? "powershell.exe"
	}
	return process.env.SHELL ?? DEFAULT_UNIX_SHELL
}

function resolveShellArgs(): string[] {
	if (process.platform === "win32") {
		return []
	}
	return ["-l"]
}

function spawnWithFallback(
	file: string,
	args: string[],
	request: PtySpawnRequest,
): IPty {
	try {
		return spawn(file, args, {
			name: "xterm-256color",
			cols: request.cols,
			rows: request.rows,
			cwd: resolveCwd(request.cwd),
			env: {
				...process.env,
				TERM: "xterm-256color",
				COLORTERM: "truecolor",
			},
		})
	} catch (error) {
		if (process.platform === "win32" || file === "/bin/sh") {
			throw error
		}
		return spawn("/bin/sh", [], {
			name: "xterm-256color",
			cols: request.cols,
			rows: request.rows,
			cwd: resolveCwd(request.cwd),
			env: {
				...process.env,
				TERM: "xterm-256color",
				COLORTERM: "truecolor",
			},
		})
	}
}

function assertSafeName(value: string, kind: string) {
	if (!value || !NAME_PATTERN.test(value)) {
		throw new Error(`invalid ${kind}`)
	}
}

export class PtyController {
	private sessions = new Map<number, PtySession>()
	private nextId = 1

	constructor(private readonly options: PtyControllerOptions = {}) {}

	spawnShell(request: PtySpawnRequest): number {
		return this.spawnPty(resolveShell(), resolveShellArgs(), request)
	}

	spawnTerminal(request: PtyTerminalSpawnRequest): number {
		if (process.platform === "win32") {
			return this.spawnShell(request)
		}

		assertSafeName(request.name, "terminal name")
		const session = `aios-term-${request.name}`
		const startup = request.command?.trim()
		const keepalive = startup ? `${startup}; exec \${SHELL:-${DEFAULT_UNIX_SHELL}}` : ""
		const cwdFlag = request.cwd?.trim() ? ` -c ${quoteSh(request.cwd)}` : ""
		const createCommand = keepalive
			? `tmux -L adletic new-session -A -d -s ${session}${cwdFlag} ${quoteSh(keepalive)}`
			: `tmux -L adletic new-session -A -d -s ${session}${cwdFlag}`
		const script = `${createCommand} 2>/dev/null; tmux -L adletic set -g mouse on 2>/dev/null; exec tmux -L adletic attach -t ${session}`
		return this.spawnPty("/bin/sh", ["-lc", script], request)
	}

	spawnOracle(request: PtyOracleSpawnRequest): number {
		assertSafeName(request.identity, "oracle identity")
		const script = `tmux -L adletic set -g mouse on 2>/dev/null; exec tmux -L adletic attach -t aios-${request.identity}`
		return this.spawnPty("/bin/sh", ["-lc", script], request)
	}

	spawnTmux(request: PtyTmuxSpawnRequest): number {
		assertSafeName(request.socket, "socket name")
		assertSafeName(request.session, "session name")
		const script = `tmux -L ${request.socket} set -g mouse on 2>/dev/null; exec tmux -L ${request.socket} attach -t ${request.session}`
		return this.spawnPty("/bin/sh", ["-lc", script], request)
	}

	write(id: number, data: string): void {
		const session = this.requireSession(id)
		session.pty.write(data)
	}

	resize(id: number, cols: number, rows: number): void {
		const session = this.requireSession(id)
		session.pty.resize(cols, rows)
	}

	kill(id: number): void {
		const session = this.requireSession(id)
		session.pty.kill()
	}

	private spawnPty(file: string, args: string[], request: PtySpawnRequest): number {
		const pty = this.options.spawnPty?.(file, args, request) ?? spawnWithFallback(file, args, request)

		const id = this.nextId++
		const onDataDispose = pty.onData((data) => {
			this.options.onData?.({ id, data })
		})
		const onExitDispose = pty.onExit(({ exitCode, signal }) => {
			const session = this.sessions.get(id)
			if (session) {
				this.disposeSession(id, session)
			}
			this.options.onExit?.({ id, exitCode, signal })
		})

		this.sessions.set(id, { pty, onDataDispose, onExitDispose })
		return id
	}

	private requireSession(id: number): PtySession {
		const session = this.sessions.get(id)
		if (!session) {
			throw new Error(`pty session ${id} not found`)
		}
		return session
	}

	private disposeSession(id: number, session: PtySession) {
		session.onDataDispose.dispose()
		session.onExitDispose.dispose()
		this.sessions.delete(id)
	}
}

export function createPtyController(options?: PtyControllerOptions): PtyController {
	return new PtyController(options)
}
