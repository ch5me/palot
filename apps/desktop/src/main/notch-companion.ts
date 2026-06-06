import { execFile } from "node:child_process"
import fs, { type FSWatcher } from "node:fs"
import path from "node:path"
import { app, BrowserWindow, screen } from "electron"
import { createLogger } from "./logger"

const log = createLogger("notch")

const NOTCH_FLAG = "--elf-notch"
const NOTCH_QUEUED_FLAG = "--elf-notch-queued"
const COMMAND_FILE_NAME = "notch-command.args"
const FALLBACK_NOTCH_WIDTH = 180
const FALLBACK_NOTCH_HEIGHT = 32
const BUBBLE_HEIGHT = 78
const SIDE_REACH = 46
const SIDE_VERTICAL_ROOM = 18
const EXIT_ANIMATION_MS = 420
const DEFAULT_DURATION_MS = 4_200

type NotchCompanionStyle = "drop" | "left" | "right" | "both"
type NotchCompanionEffect = "none" | "spark" | "prism" | "rift" | "bloom" | "metal"

const DEMO_EFFECTS: readonly NotchCompanionEffect[] = ["spark", "prism", "rift", "bloom", "metal"]

export interface NotchCompanionCommand {
	action: "show" | "say" | "hide" | "clear" | "demo"
	text?: string
	mood?: string
	pose?: string
	style?: NotchCompanionStyle
	effect?: NotchCompanionEffect
	durationMs?: number
}

interface NotchGeometry {
	x: number
	y: number
	width: number
	height: number
	displayWidth: number
	displayHeight: number
}

let notchWindow: BrowserWindow | null = null
let loadPromise: Promise<void> | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let exitTimer: ReturnType<typeof setTimeout> | null = null
let commandWatcher: FSWatcher | null = null
let commandReadTimer: ReturnType<typeof setTimeout> | null = null
let lastCommandId: string | null = null

export function hasNotchCommandArgv(argv: readonly string[]): boolean {
	return argv.includes(NOTCH_FLAG) || argv.includes(NOTCH_QUEUED_FLAG)
}

export function readNotchCommandArgv(argv: readonly string[]): NotchCompanionCommand | null {
	const flagIndex = argv.indexOf(NOTCH_FLAG)
	if (flagIndex === -1) return null

	const args = argv.slice(flagIndex + 1)
	if (args.length === 0) return { action: "show" }

	const actionToken = args[0]
	const action =
		actionToken === "hide" ||
		actionToken === "clear" ||
		actionToken === "show" ||
		actionToken === "say" ||
		actionToken === "demo"
			? actionToken
			: "say"
	const rest = action === actionToken ? args.slice(1) : args
	const parsed = parseNotchArgs(rest)

	return {
		action,
		text: parsed.text,
		mood: parsed.mood,
		pose: parsed.pose,
		style: parsed.style,
		effect: parsed.effect,
		durationMs: parsed.durationMs,
	}
}

export async function handleNotchCommandArgv(argv: readonly string[]): Promise<boolean> {
	if (argv.includes(NOTCH_QUEUED_FLAG)) {
		await flushQueuedNotchCommand()
		return true
	}

	const command = readNotchCommandArgv(argv)
	if (!command) return false
	await runNotchCompanionCommand(command)
	return true
}

export function initNotchCommandFileWatcher(): void {
	if (process.platform !== "darwin" || commandWatcher) return

	const commandDir = getNotchCommandDir()
	fs.mkdirSync(commandDir, { recursive: true })
	commandWatcher = fs.watch(commandDir, (_event, filename) => {
		if (filename?.toString() !== COMMAND_FILE_NAME) return
		if (commandReadTimer) clearTimeout(commandReadTimer)
		commandReadTimer = setTimeout(() => {
			flushQueuedNotchCommand().catch((err) => log.warn("Failed to read queued notch command", err))
		}, 50)
	})
	flushQueuedNotchCommand().catch((err) => log.warn("Failed to read initial notch command", err))
}

export function shutdownNotchCommandFileWatcher(): void {
	if (commandReadTimer) clearTimeout(commandReadTimer)
	commandReadTimer = null
	commandWatcher?.close()
	commandWatcher = null
}

export async function flushQueuedNotchCommand(): Promise<boolean> {
	const queued = await readQueuedNotchCommand()
	if (!queued || queued.id === lastCommandId) return false
	lastCommandId = queued.id
	await runNotchCompanionCommand(queued.command)
	return true
}

export async function runNotchCompanionCommand(command: NotchCompanionCommand): Promise<void> {
	if (process.platform !== "darwin") {
		log.warn("Notch companion is macOS-only")
		return
	}

	if (command.action === "demo") {
		for (const effect of DEMO_EFFECTS) {
			await runNotchCompanionCommand({
				action: "say",
				text: effect,
				mood: effect === "bloom" ? "quiet" : "busy",
				pose: "wave",
				style: "drop",
				effect,
				durationMs: 2_400,
			})
			await delay(2_700)
		}
		return
	}

	if (command.action === "hide" || command.action === "clear") {
		clearTimers()
		const win = notchWindow
		if (!win || win.isDestroyed()) return
		if (loadPromise) await loadPromise
		await win.webContents.executeJavaScript("window.__elfNotchExit?.()")
		hideTimer = setTimeout(() => {
			notchWindow?.hide()
		}, EXIT_ANIMATION_MS)
		return
	}

	clearTimers()
	const win = await ensureNotchWindow()
	const geometry = await resolveNotchGeometry()
	const style = command.style ?? "drop"
	const effect = command.effect ?? "none"
	const bounds = positionNotchWindow(win, geometry, style)
	win.showInactive()
	log.info("Showing notch companion", {
		notch: geometry,
		bounds,
		style,
		effect,
		text: command.text ?? null,
		mood: command.mood ?? null,
		pose: command.pose ?? null,
	})

	const durationMs = command.durationMs ?? DEFAULT_DURATION_MS
	const payload = JSON.stringify({
		text: command.text ?? "Ready",
		mood: command.mood ?? "neutral",
		pose: command.pose ?? (command.action === "say" ? "talk" : "peek"),
		style,
		effect,
		durationMs,
		notchWidth: geometry.width,
		notchHeight: geometry.height,
		bubbleHeight: BUBBLE_HEIGHT,
		notchLeft: geometry.x - bounds.x,
	})

	await executeInNotchWindow(`window.__elfNotchPrime?.(${payload})`)
	if (style === "drop") await delay(effect === "none" ? 90 : 420)
	await executeInNotchWindow("window.__elfNotchEnter?.()")
	scheduleHide(durationMs)
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readQueuedNotchCommand(): Promise<{ id: string; command: NotchCompanionCommand } | null> {
	let content: string
	try {
		content = await fs.promises.readFile(getNotchCommandPath(), "utf8")
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === "ENOENT") return null
		throw err
	}

	const parsed = parseQueuedNotchCommand(content)
	if (!parsed) return null
	return parsed
}

function parseQueuedNotchCommand(content: string): { id: string; command: NotchCompanionCommand } | null {
	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)

	if (lines[0] !== "elf-notch-v1") return null

	const id = lines.find((line) => line.startsWith("id="))?.slice(3)
	const args = lines
		.filter((line) => line.startsWith("arg="))
		.map((line) => Buffer.from(line.slice(4), "base64").toString("utf8"))
	if (!id) return null

	const command = readNotchCommandArgv([NOTCH_FLAG, ...args])
	if (!command) return null

	return { id, command }
}

function getNotchCommandPath(): string {
	return path.join(getNotchCommandDir(), COMMAND_FILE_NAME)
}

function getNotchCommandDir(): string {
	const dataHome = process.env.XDG_DATA_HOME || path.join(app.getPath("home"), ".local", "share")
	return path.join(dataHome, "elf")
}

function parseNotchArgs(args: readonly string[]): {
	text?: string
	mood?: string
	pose?: string
	style?: NotchCompanionStyle
	effect?: NotchCompanionEffect
	durationMs?: number
} {
	const words: string[] = []
	let text: string | undefined
	let mood: string | undefined
	let pose: string | undefined
	let style: NotchCompanionStyle | undefined
	let effect: NotchCompanionEffect | undefined
	let durationMs: number | undefined

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index]
		const next = args[index + 1]
		if ((arg === "--text" || arg === "-t") && next) {
			text = next
			index += 1
			continue
		}
		if ((arg === "--mood" || arg === "-m") && next) {
			mood = next
			index += 1
			continue
		}
		if ((arg === "--pose" || arg === "-p") && next) {
			pose = next
			index += 1
			continue
		}
		if ((arg === "--style" || arg === "--from" || arg === "--mode" || arg === "-s") && next) {
			style = parseStyle(next)
			index += 1
			continue
		}
		if ((arg === "--effect" || arg === "--fx" || arg === "-e") && next) {
			effect = parseEffect(next)
			index += 1
			continue
		}
		if ((arg === "--for" || arg === "--duration" || arg === "-d") && next) {
			durationMs = parseDurationMs(next)
			index += 1
			continue
		}
		if (arg.startsWith("--")) continue
		words.push(arg)
	}

	if (!text && words.length > 0) text = words.join(" ")

	return { text, mood, pose, style, effect, durationMs }
}

function parseStyle(value: string): NotchCompanionStyle | undefined {
	if (value === "drop" || value === "left" || value === "right" || value === "both") return value
	return undefined
}

function parseEffect(value: string): NotchCompanionEffect | undefined {
	if (
		value === "none" ||
		value === "spark" ||
		value === "prism" ||
		value === "rift" ||
		value === "bloom" ||
		value === "metal"
	) {
		return value
	}
	return undefined
}

function parseDurationMs(value: string): number | undefined {
	const normalized = value.trim().toLowerCase()
	const match = normalized.match(/^(\d+(?:\.\d+)?)(ms|s)?$/)
	if (!match) return undefined

	const amount = Number.parseFloat(match[1])
	if (!Number.isFinite(amount) || amount <= 0) return undefined

	const unit = match[2]
	const ms = unit === "s" ? amount * 1_000 : amount
	return Math.min(Math.max(Math.round(ms), 700), 30_000)
}

async function ensureNotchWindow(): Promise<BrowserWindow> {
	if (notchWindow && !notchWindow.isDestroyed()) return notchWindow

	notchWindow = new BrowserWindow({
		width: FALLBACK_NOTCH_WIDTH,
		height: FALLBACK_NOTCH_HEIGHT + BUBBLE_HEIGHT,
		show: false,
		frame: false,
		transparent: true,
		resizable: false,
		movable: false,
		minimizable: false,
		maximizable: false,
		closable: false,
		focusable: false,
		skipTaskbar: true,
		hasShadow: false,
		roundedCorners: false,
		fullscreenable: false,
		backgroundColor: "#00000000",
		title: "Elf Notch Companion",
		webPreferences: {
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			spellcheck: false,
		},
	})

	notchWindow.setIgnoreMouseEvents(true, { forward: true })
	notchWindow.setAlwaysOnTop(true, "screen-saver")
	notchWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
	notchWindow.on("closed", () => {
		notchWindow = null
		loadPromise = null
		clearTimers()
	})

	loadPromise = new Promise((resolve) => {
		notchWindow?.webContents.once("did-finish-load", () => resolve())
	})
	await notchWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(createNotchHtml())}`)
	await loadPromise

	return notchWindow
}

async function resolveNotchGeometry(): Promise<NotchGeometry> {
	try {
		const geometry = await getAppKitNotchGeometry()
		if (geometry.width > 0 && geometry.height > 0) return geometry
	} catch (err) {
		log.warn("Falling back to centered notch geometry", err)
	}

	const display = screen.getPrimaryDisplay()
	return {
		x: Math.round(display.bounds.x + (display.bounds.width - FALLBACK_NOTCH_WIDTH) / 2),
		y: display.bounds.y,
		width: FALLBACK_NOTCH_WIDTH,
		height: FALLBACK_NOTCH_HEIGHT,
		displayWidth: display.bounds.width,
		displayHeight: display.bounds.height,
	}
}

async function getAppKitNotchGeometry(): Promise<NotchGeometry> {
	const script = String.raw`
ObjC.import("AppKit")
const screen = $.NSScreen.mainScreen
const frame = screen.frame
const insets = screen.safeAreaInsets
const left = screen.auxiliaryTopLeftArea
const right = screen.auxiliaryTopRightArea
const notchX = left.origin.x + left.size.width
const notchWidth = Math.max(0, right.origin.x - notchX)
JSON.stringify({
	x: notchX,
	y: 0,
	width: notchWidth,
	height: Math.max(insets.top, left.size.height, right.size.height),
	displayWidth: frame.size.width,
	displayHeight: frame.size.height
})
`
	const stdout = await execFileText("/usr/bin/osascript", ["-l", "JavaScript", "-e", script])
	const parsed = JSON.parse(stdout) as Partial<NotchGeometry>
	return {
		x: Math.round(Number(parsed.x) || 0),
		y: Math.round(Number(parsed.y) || 0),
		width: Math.round(Number(parsed.width) || 0),
		height: Math.round(Number(parsed.height) || 0),
		displayWidth: Math.round(Number(parsed.displayWidth) || 0),
		displayHeight: Math.round(Number(parsed.displayHeight) || 0),
	}
}

function execFileText(file: string, args: string[]): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(file, args, { timeout: 5_000 }, (err, stdout, stderr) => {
			if (err) {
				reject(err)
				return
			}
			if (stderr.trim()) log.warn("Notch geometry probe stderr", stderr.trim())
			resolve(stdout.trim())
		})
	})
}

function positionNotchWindow(
	win: BrowserWindow,
	geometry: NotchGeometry,
	style: NotchCompanionStyle,
): Electron.Rectangle {
	const leftReach = style === "left" || style === "both" ? SIDE_REACH : 0
	const rightReach = style === "right" || style === "both" ? SIDE_REACH : 0
	const width = geometry.width + leftReach + rightReach
	const height =
		style === "drop" ? geometry.height + BUBBLE_HEIGHT : geometry.height + SIDE_VERTICAL_ROOM
	const bounds = {
		x: geometry.x - leftReach,
		y: geometry.y,
		width,
		height,
	}
	win.setBounds(bounds, false)
	return bounds
}

async function executeInNotchWindow(script: string): Promise<void> {
	const win = await ensureNotchWindow()
	if (loadPromise) await loadPromise
	if (win.isDestroyed()) return
	await win.webContents.executeJavaScript(script)
}

function scheduleHide(durationMs: number): void {
	clearTimers()
	const exitDelay = Math.max(durationMs - EXIT_ANIMATION_MS, 250)
	exitTimer = setTimeout(() => {
		void executeInNotchWindow("window.__elfNotchExit?.()")
	}, exitDelay)
	hideTimer = setTimeout(() => {
		notchWindow?.hide()
	}, durationMs)
}

function clearTimers(): void {
	if (hideTimer) clearTimeout(hideTimer)
	if (exitTimer) clearTimeout(exitTimer)
	hideTimer = null
	exitTimer = null
}

function createNotchHtml(): string {
	const appName = app.getName()
	return String.raw`<!doctype html>
<html>
<head>
	<meta charset="utf-8" />
	<meta name="color-scheme" content="dark" />
	<title>${escapeHtml(appName)} Notch Companion</title>
	<style>
		:root {
			color-scheme: dark;
			font-family: ui-rounded, "SF Pro Rounded", "Avenir Next", sans-serif;
			--notch-width: 180px;
			--notch-half: 90px;
			--notch-left: 0px;
			--notch-height: 32px;
			--notch-overlap: 14px;
			--side-size: 32px;
			--side-top: 8px;
			--bubble-height: 78px;
		}

		* {
			box-sizing: border-box;
		}

		html,
		body {
			width: 100%;
			height: 100%;
			margin: 0;
			overflow: hidden;
			background: transparent;
		}

		body {
			display: grid;
			place-items: start center;
			opacity: 1;
			transform: none;
		}

		body.exiting .stage {
			transform: scaleY(0);
			transition: transform 280ms cubic-bezier(0.7, 0, 0.84, 0);
		}

		.shell {
			position: relative;
			width: 100%;
			height: 100%;
			display: grid;
			justify-items: center;
			pointer-events: none;
		}

		.notch {
			position: absolute;
			top: 0;
			left: var(--notch-left);
			z-index: 5;
			width: var(--notch-width);
			height: var(--notch-height);
			border-radius: 0 0 calc(var(--notch-height) * 0.72) calc(var(--notch-height) * 0.72);
			background:
				radial-gradient(circle at 50% 34%, rgba(255, 255, 255, 0.08), transparent 24px),
				#050505;
			box-shadow: inset 0 -1px 0 rgba(255, 255, 255, 0.04);
		}

		.effect-layer {
			position: absolute;
			z-index: 2;
			left: var(--notch-left);
			top: calc(var(--notch-height) - var(--notch-overlap));
			width: var(--notch-width);
			height: calc(var(--bubble-height) + var(--notch-overlap));
			overflow: hidden;
			border-radius: 0 0 24px 24px;
			opacity: 0;
			pointer-events: none;
			isolation: isolate;
			filter: saturate(1.18);
			mix-blend-mode: screen;
		}

		[data-effect="spark"] .effect-layer,
		[data-effect="prism"] .effect-layer,
		[data-effect="rift"] .effect-layer,
		[data-effect="bloom"] .effect-layer,
		[data-effect="metal"] .effect-layer {
			opacity: 1;
		}

		.seed {
			position: absolute;
			left: 50%;
			top: 2px;
			z-index: 2;
			width: 9px;
			height: 9px;
			border-radius: 999px;
			background: #fff8a8;
			box-shadow:
				0 0 10px rgba(255, 248, 168, 0.95),
				0 0 20px rgba(53, 242, 194, 0.65);
			opacity: 0;
			transform: translateX(-50%) scale(0.2);
		}

		.energy-line {
			position: absolute;
			left: 50%;
			top: 5px;
			z-index: 2;
			width: 76%;
			height: 3px;
			border-radius: 999px;
			background: linear-gradient(90deg, transparent, #68ffe1, #fff266, #ff6ff5, transparent);
			box-shadow:
				0 0 12px #68ffe1,
				0 0 24px rgba(255, 111, 245, 0.65);
			transform: translateX(-50%) scaleX(0);
			transform-origin: center;
			opacity: 0;
		}

		.energy-glow {
			position: absolute;
			left: 50%;
			top: -24px;
			width: 148px;
			height: 92px;
			border-radius: 999px;
			background: radial-gradient(circle, rgba(112, 255, 225, 0.48), rgba(255, 111, 245, 0.2) 42%, transparent 72%);
			filter: blur(10px);
			transform: translateX(-50%) scale(0.25);
			opacity: 0;
		}

		.pulse-ring {
			position: absolute;
			left: 50%;
			top: -1px;
			z-index: 1;
			width: 26px;
			height: 10px;
			border: 1px solid rgba(255, 248, 168, 0.85);
			border-radius: 999px;
			box-shadow:
				0 0 12px rgba(104, 255, 225, 0.72),
				0 0 24px rgba(255, 111, 245, 0.48);
			opacity: 0;
			transform: translateX(-50%) scale(0.3);
		}

		.distortion {
			position: absolute;
			left: 50%;
			top: -5px;
			width: calc(var(--notch-width) * 0.86);
			height: 70px;
			border-radius: 999px;
			background:
				repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.22) 0 1px, transparent 1px 7px),
				repeating-linear-gradient(0deg, rgba(104, 255, 225, 0.16) 0 1px, transparent 1px 6px),
				radial-gradient(circle, rgba(105, 255, 230, 0.28), rgba(255, 255, 255, 0.05) 42%, transparent 70%);
			backdrop-filter: blur(3px) saturate(2.2) hue-rotate(28deg);
			box-shadow:
				0 0 20px rgba(104, 255, 225, 0.28),
				inset 0 0 18px rgba(255, 111, 245, 0.12);
			transform: translateX(-50%) scaleX(0.18) scaleY(0.25);
			opacity: 0;
		}

		.rift-slice {
			position: absolute;
			left: 10%;
			top: calc(8px + var(--i) * 9px);
			width: 80%;
			height: 2px;
			border-radius: 999px;
			background: linear-gradient(90deg, transparent, rgba(156, 255, 240, 0.8), rgba(255, 111, 245, 0.7), transparent);
			box-shadow: 0 0 10px rgba(104, 255, 225, 0.54);
			opacity: 0;
			transform: translateX(calc((var(--i) - 2) * 8px)) scaleX(0.15);
		}

		.metal-sheen {
			position: absolute;
			inset: 0;
			background:
				linear-gradient(112deg, transparent 4%, rgba(255, 255, 255, 0.86) 14%, transparent 24%),
				linear-gradient(90deg, rgba(53, 242, 194, 0.38), rgba(255, 226, 92, 0.44), rgba(255, 92, 196, 0.34));
			filter: blur(0.15px) saturate(1.7) contrast(1.12);
			transform: translateX(-105%) skewX(-12deg);
			opacity: 0;
		}

		.metal-thread {
			position: absolute;
			left: 50%;
			top: 2px;
			width: 82%;
			height: 7px;
			border-radius: 999px;
			background:
				linear-gradient(90deg, transparent, #f8fcff, #6effe3, #fff266, #ff6ff5, #f8fcff, transparent);
			box-shadow:
				0 0 14px rgba(248, 252, 255, 0.72),
				0 0 28px rgba(104, 255, 225, 0.42);
			opacity: 0;
			transform: translateX(-50%) scaleX(0);
			transform-origin: center;
		}

		.prism-ray {
			position: absolute;
			top: 5px;
			left: 50%;
			width: 54px;
			height: 80px;
			clip-path: polygon(50% 0, 0 100%, 100% 100%);
			background: linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(104, 255, 225, 0.14), transparent 84%);
			filter: blur(0.35px);
			opacity: 0;
			transform-origin: 50% 0;
			transform: translateX(-50%) scaleY(0.12);
		}

		.prism-ray.one {
			margin-left: -38px;
			background: linear-gradient(180deg, rgba(104, 255, 225, 0.74), rgba(104, 255, 225, 0.1), transparent 84%);
			transform: translateX(-50%) rotate(-17deg) scaleY(0.12);
		}

		.prism-ray.two {
			background: linear-gradient(180deg, rgba(255, 242, 102, 0.74), rgba(255, 242, 102, 0.1), transparent 84%);
		}

		.prism-ray.three {
			margin-left: 38px;
			background: linear-gradient(180deg, rgba(255, 111, 245, 0.74), rgba(255, 111, 245, 0.1), transparent 84%);
			transform: translateX(-50%) rotate(17deg) scaleY(0.12);
		}

		.spark {
			position: absolute;
			left: 50%;
			top: 6px;
			width: 3px;
			height: 3px;
			border-radius: 999px;
			background: #fff8a8;
			box-shadow:
				0 0 10px #35f2c2,
				0 0 18px rgba(255, 248, 168, 0.7);
			opacity: 0;
		}

		[data-effect="spark"] .energy-line,
		[data-effect="prism"] .energy-line,
		[data-effect="metal"] .energy-line {
			animation: line-build 620ms cubic-bezier(0.16, 1, 0.3, 1) both;
		}

		[data-effect="spark"] .seed,
		[data-effect="prism"] .seed,
		[data-effect="bloom"] .seed,
		[data-effect="metal"] .seed {
			animation: seed-pop 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
		}

		[data-effect="spark"] .pulse-ring,
		[data-effect="bloom"] .pulse-ring {
			animation: ring-burst 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
		}

		[data-effect="spark"] .energy-glow {
			background: radial-gradient(circle, rgba(255, 248, 168, 0.58), rgba(53, 242, 194, 0.3) 42%, transparent 72%);
			animation: spark-glow 980ms ease both;
		}

		[data-effect="spark"] .spark {
			animation: spark-pop 1.45s cubic-bezier(0.16, 1, 0.3, 1) infinite both;
			animation-delay: var(--delay);
		}

		[data-effect="prism"] .energy-glow {
			animation: prism-glow 1.2s ease both;
		}

		[data-effect="prism"] .effect-layer {
			background: conic-gradient(from 210deg at 50% 12%, rgba(105, 255, 230, 0.34), rgba(255, 242, 102, 0.2), rgba(255, 111, 245, 0.34), rgba(105, 255, 230, 0.34));
			animation: prism-spin 1.8s linear infinite;
		}

		[data-effect="prism"] .prism-ray {
			animation: prism-ray 920ms cubic-bezier(0.16, 1, 0.3, 1) both;
		}

		[data-effect="rift"] .distortion {
			animation:
				rift-open 1.15s cubic-bezier(0.16, 1, 0.3, 1) both,
				rift-jitter 1.8s steps(2, end) 1.15s infinite;
		}

		[data-effect="rift"] .rift-slice {
			animation: rift-slice 1.35s cubic-bezier(0.16, 1, 0.3, 1) infinite both;
			animation-delay: calc(var(--i) * 46ms);
		}

		[data-effect="rift"] .energy-line {
			background: linear-gradient(90deg, transparent, #9cfff0, #ffffff, #ff6ff5, transparent);
			animation: line-build 540ms cubic-bezier(0.16, 1, 0.3, 1) both;
		}

		[data-effect="bloom"] .energy-glow {
			background: radial-gradient(circle, rgba(158, 245, 255, 0.74), rgba(141, 140, 255, 0.36) 42%, transparent 72%);
			animation: bloom-breathe 1.6s ease-in-out infinite;
		}

		[data-effect="bloom"] .energy-line {
			background: linear-gradient(90deg, transparent, #9ef5ff, #ffffff, #8d8cff, transparent);
			animation: line-build 760ms cubic-bezier(0.16, 1, 0.3, 1) both;
		}

		[data-effect="metal"] .metal-sheen {
			animation: metal-pass 1.35s cubic-bezier(0.16, 1, 0.3, 1) infinite both;
		}

		[data-effect="metal"] .metal-thread {
			animation:
				metal-thread 920ms cubic-bezier(0.16, 1, 0.3, 1) both,
				metal-thread-pulse 1.4s ease-in-out 920ms infinite;
		}

		.stage {
			position: absolute;
			z-index: 3;
			left: var(--notch-left);
			top: calc(var(--notch-height) - var(--notch-overlap));
			width: var(--notch-width);
			height: var(--bubble-height);
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: start;
			gap: 5px;
			padding: 12px 8px 8px;
			border-radius: 0 0 24px 24px;
			background: linear-gradient(180deg, rgba(8, 8, 8, 0.72), rgba(15, 15, 16, 0.54));
			box-shadow:
				0 16px 34px rgba(0, 0, 0, 0.42),
				inset 0 1px 0 rgba(255, 255, 255, 0.07);
			overflow: hidden;
			transform-origin: top center;
			transform: scaleY(0);
			transition: transform 380ms cubic-bezier(0.16, 1, 0.3, 1);
			will-change: transform;
		}

		body.visible .stage {
			transform: scaleY(1);
		}

		[data-style="left"] .stage,
		[data-style="right"] .stage,
		[data-style="both"] .stage {
			display: none;
		}

		.side-character {
			position: absolute;
			z-index: 1;
			top: var(--side-top);
			width: var(--side-size);
			height: var(--side-size);
			border-radius: calc(var(--side-size) * 0.34);
			background:
				radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.92) 0 2px, transparent 3px),
				linear-gradient(145deg, #35f2c2, #1582ff 70%);
			box-shadow:
				0 6px 14px rgba(21, 130, 255, 0.24),
				inset 0 -5px 8px rgba(0, 0, 0, 0.2);
			opacity: 0;
			transition:
				opacity 140ms ease,
				transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
		}

		.side-character.left {
			left: calc(var(--notch-left) - var(--side-size) - 4px);
			transform: translateX(calc(var(--side-size) + 10px));
		}

		.side-character.right {
			left: calc(var(--notch-left) + var(--notch-width) + 4px);
			transform: translateX(calc((var(--side-size) + 10px) * -1));
		}

		[data-style="left"] .side-character.left,
		[data-style="both"] .side-character.left,
		[data-style="right"] .side-character.right,
		[data-style="both"] .side-character.right {
			opacity: 1;
			transform: translateX(0);
		}

		body.exiting .side-character.left {
			opacity: 0;
			transform: translateX(calc(var(--side-size) + 10px));
		}

		body.exiting .side-character.right {
			opacity: 0;
			transform: translateX(calc((var(--side-size) + 10px) * -1));
		}

		.side-character::before,
		.side-character::after {
			content: "";
			position: absolute;
			top: calc(var(--side-size) * 0.42);
			width: calc(var(--side-size) * 0.1);
			height: calc(var(--side-size) * 0.18);
			border-radius: 999px;
			background: #061315;
		}

		.side-character::before {
			left: calc(var(--side-size) * 0.34);
		}

		.side-character::after {
			right: calc(var(--side-size) * 0.34);
		}

		.character {
			position: relative;
			width: 42px;
			height: 42px;
			border-radius: 15px 15px 13px 13px;
			background:
				radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.92) 0 3px, transparent 4px),
				linear-gradient(145deg, #35f2c2, #1582ff 70%);
			box-shadow:
				0 8px 18px rgba(21, 130, 255, 0.24),
				inset 0 -7px 12px rgba(0, 0, 0, 0.22);
			animation: bob 1.9s ease-in-out infinite;
			opacity: 0;
			transform: translateY(-16px);
			transition:
				opacity 160ms ease 100ms,
				transform 260ms ease 100ms;
		}

		body.visible .character {
			opacity: 1;
			transform: translateY(0);
		}

		.character::before,
		.character::after {
			content: "";
			position: absolute;
			top: 17px;
			width: 6px;
			height: 9px;
			border-radius: 999px;
			background: #061315;
			box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.12);
		}

		.character::before {
			left: 13px;
		}

		.character::after {
			right: 13px;
		}

		.mouth {
			position: absolute;
			left: 18px;
			top: 29px;
			width: 8px;
			height: 4px;
			border-radius: 0 0 999px 999px;
			background: rgba(3, 9, 10, 0.78);
			transform-origin: center top;
		}

		[data-pose="talk"] .mouth {
			animation: talk 260ms ease-in-out infinite alternate;
		}

		.arm {
			position: absolute;
			right: -7px;
			top: 23px;
			width: 14px;
			height: 6px;
			border-radius: 999px;
			background: #35f2c2;
			transform-origin: left center;
		}

		[data-pose="wave"] .arm {
			animation: wave 520ms ease-in-out infinite alternate;
		}

		.copy {
			min-width: 0;
			width: 100%;
			display: grid;
			gap: 4px;
			color: white;
			text-align: center;
			text-shadow: 0 1px 2px rgba(0, 0, 0, 0.48);
			opacity: 0;
			transform: translateY(-6px);
			transition:
				opacity 180ms ease 140ms,
				transform 260ms ease 140ms;
		}

		body.visible .copy {
			opacity: 1;
			transform: translateY(0);
		}

		.eyebrow {
			display: none;
		}

		.message {
			max-height: 22px;
			overflow: hidden;
			font-size: 10px;
			font-weight: 700;
			line-height: 1.16;
			letter-spacing: 0;
			overflow-wrap: anywhere;
		}

		[data-mood="busy"] .character {
			background:
				radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.92) 0 3px, transparent 4px),
				linear-gradient(145deg, #ffe55c, #ff7a3d 70%);
		}

		[data-mood="quiet"] .character {
			background:
				radial-gradient(circle at 34% 30%, rgba(255, 255, 255, 0.88) 0 3px, transparent 4px),
				linear-gradient(145deg, #9ef5ff, #8d8cff 70%);
		}

		@keyframes line-build {
			0% {
				opacity: 0;
				transform: translateX(-50%) scaleX(0);
			}
			45% {
				opacity: 1;
			}
			100% {
				opacity: 0.9;
				transform: translateX(-50%) scaleX(1);
			}
		}

		@keyframes seed-pop {
			0% {
				opacity: 0;
				transform: translateX(-50%) scale(0.2);
			}
			35% {
				opacity: 1;
				transform: translateX(-50%) scale(1.2);
			}
			100% {
				opacity: 0.78;
				transform: translateX(-50%) scale(0.74);
			}
		}

		@keyframes ring-burst {
			0% {
				opacity: 0;
				transform: translateX(-50%) scale(0.24);
			}
			22% {
				opacity: 0.95;
			}
			100% {
				opacity: 0;
				transform: translateX(-50%) scale(5.8);
			}
		}

		@keyframes spark-glow {
			0% {
				opacity: 0;
				transform: translateX(-50%) scale(0.2);
			}
			52% {
				opacity: 0.95;
				transform: translateX(-50%) scale(1);
			}
			100% {
				opacity: 0.3;
				transform: translateX(-50%) scale(0.82);
			}
		}

		@keyframes spark-pop {
			0% {
				opacity: 0;
				transform: translate(-50%, 0) scale(0.1);
			}
			35% {
				opacity: 1;
			}
			100% {
				opacity: 0;
				transform: translate(calc(-50% + var(--spark-x)), var(--spark-y)) scale(1.15);
			}
		}

		@keyframes prism-glow {
			0% {
				opacity: 0;
				transform: translateX(-50%) scale(0.22);
			}
			60% {
				opacity: 0.95;
			}
			100% {
				opacity: 0.42;
				transform: translateX(-50%) scale(1);
			}
		}

		@keyframes prism-ray {
			0% {
				opacity: 0;
				transform: translateX(-50%) rotate(var(--ray-rotate, 0deg)) scaleY(0.12);
			}
			54% {
				opacity: 0.82;
			}
			100% {
				opacity: 0.22;
				transform: translateX(-50%) rotate(var(--ray-rotate, 0deg)) scaleY(1);
			}
		}

		@keyframes prism-spin {
			from {
				filter: hue-rotate(0deg) saturate(1.5);
			}
			to {
				filter: hue-rotate(360deg) saturate(1.5);
			}
		}

		@keyframes rift-open {
			0% {
				opacity: 0;
				transform: translateX(-50%) scaleX(0.18) scaleY(0.25);
			}
			50% {
				opacity: 0.85;
			}
			100% {
				opacity: 0.38;
				transform: translateX(-50%) scaleX(1) scaleY(1);
			}
		}

		@keyframes rift-slice {
			0% {
				opacity: 0;
				transform: translateX(calc((var(--i) - 2) * 12px)) scaleX(0.12);
			}
			42% {
				opacity: 0.9;
			}
			100% {
				opacity: 0.24;
				transform: translateX(calc((var(--i) - 2) * -7px)) scaleX(1);
			}
		}

		@keyframes rift-jitter {
			0%,
			100% {
				filter: hue-rotate(0deg);
				transform: translateX(-50%) scaleX(1) scaleY(1);
			}
			50% {
				filter: hue-rotate(22deg);
				transform: translateX(calc(-50% + 3px)) scaleX(0.98) scaleY(1.02);
			}
		}

		@keyframes bloom-breathe {
			0%,
			100% {
				opacity: 0.35;
				transform: translateX(-50%) scale(0.78);
			}
			50% {
				opacity: 0.9;
				transform: translateX(-50%) scale(1.08);
			}
		}

		@keyframes metal-pass {
			0% {
				opacity: 0;
				transform: translateX(-105%) skewX(-12deg);
			}
			25% {
				opacity: 0.8;
			}
			100% {
				opacity: 0;
				transform: translateX(105%) skewX(-12deg);
			}
		}

		@keyframes metal-thread {
			0% {
				opacity: 0;
				transform: translateX(-50%) scaleX(0);
			}
			46% {
				opacity: 1;
				transform: translateX(-50%) scaleX(1);
			}
			100% {
				opacity: 0.42;
				transform: translateX(-50%) scaleX(0.86);
			}
		}

		@keyframes metal-thread-pulse {
			0%,
			100% {
				filter: saturate(1.2);
				opacity: 0.45;
			}
			50% {
				filter: saturate(2) brightness(1.45);
				opacity: 0.95;
			}
		}

		@keyframes bob {
			0%,
			100% {
				transform: translateY(0);
			}
			50% {
				transform: translateY(5px);
			}
		}

		@keyframes talk {
			from {
				transform: scaleY(0.75);
			}
			to {
				transform: scaleY(1.8);
			}
		}

		@keyframes wave {
			from {
				transform: rotate(-18deg);
			}
			to {
				transform: rotate(24deg);
			}
		}
	</style>
</head>
<body>
	<div class="shell" id="root" data-mood="neutral" data-pose="peek" data-style="drop" data-effect="none">
		<div class="notch"></div>
		<div class="effect-layer" aria-hidden="true">
			<div class="seed"></div>
			<div class="energy-line"></div>
			<div class="pulse-ring"></div>
			<div class="energy-glow"></div>
			<div class="prism-ray one" style="--ray-rotate: -17deg"></div>
			<div class="prism-ray two" style="--ray-rotate: 0deg"></div>
			<div class="prism-ray three" style="--ray-rotate: 17deg"></div>
			<div class="distortion"></div>
			<div class="rift-slice" style="--i: 0"></div>
			<div class="rift-slice" style="--i: 1"></div>
			<div class="rift-slice" style="--i: 2"></div>
			<div class="rift-slice" style="--i: 3"></div>
			<div class="rift-slice" style="--i: 4"></div>
			<div class="metal-sheen"></div>
			<div class="metal-thread"></div>
			<span class="spark" style="--spark-x: -62px; --spark-y: 12px; --delay: 30ms"></span>
			<span class="spark" style="--spark-x: -46px; --spark-y: 40px; --delay: 110ms"></span>
			<span class="spark" style="--spark-x: -20px; --spark-y: 24px; --delay: 70ms"></span>
			<span class="spark" style="--spark-x: 10px; --spark-y: 38px; --delay: 145ms"></span>
			<span class="spark" style="--spark-x: 38px; --spark-y: 18px; --delay: 20ms"></span>
			<span class="spark" style="--spark-x: 62px; --spark-y: 43px; --delay: 180ms"></span>
			<span class="spark" style="--spark-x: -4px; --spark-y: 58px; --delay: 220ms"></span>
			<span class="spark" style="--spark-x: 26px; --spark-y: 63px; --delay: 90ms"></span>
		</div>
		<div class="side-character left" aria-hidden="true"></div>
		<div class="side-character right" aria-hidden="true"></div>
		<div class="stage">
			<div class="character" aria-hidden="true">
				<div class="mouth"></div>
				<div class="arm"></div>
			</div>
			<div class="copy">
				<div class="eyebrow" id="mood"></div>
				<div class="message" id="message">Ready</div>
			</div>
		</div>
	</div>
	<script>
		const body = document.body
		const root = document.getElementById("root")
		const mood = document.getElementById("mood")
		const message = document.getElementById("message")

		window.__elfNotchPrime = (payload) => {
			const nextMood = payload?.mood || "neutral"
			const nextPose = payload?.pose || "peek"
			const nextStyle = payload?.style || "drop"
			const nextEffect = payload?.effect || "none"
			const notchWidth = Math.max(120, Number(payload?.notchWidth) || 180)
			const notchHeight = Math.max(24, Number(payload?.notchHeight) || 32)
			const bubbleHeight = Math.max(64, Number(payload?.bubbleHeight) || 78)
			const notchLeft = Math.max(0, Number(payload?.notchLeft) || 0)
			root.style.setProperty("--notch-width", notchWidth + "px")
			root.style.setProperty("--notch-half", notchWidth / 2 + "px")
			root.style.setProperty("--notch-left", notchLeft + "px")
			root.style.setProperty("--notch-height", notchHeight + "px")
			root.style.setProperty("--side-size", notchHeight + "px")
			root.style.setProperty("--bubble-height", bubbleHeight + "px")
			root.dataset.mood = nextMood
			root.dataset.pose = nextPose
			root.dataset.style = nextStyle
			root.dataset.effect = "none"
			mood.textContent = ""
			message.textContent = payload?.text || "Ready"
			body.classList.remove("exiting")
			body.classList.remove("visible")
			void root.offsetWidth
			root.dataset.effect = nextEffect
		}

		window.__elfNotchEnter = () => {
			requestAnimationFrame(() => body.classList.add("visible"))
		}

		window.__elfNotchExit = () => {
			body.classList.add("exiting")
			body.classList.remove("visible")
		}
	</script>
</body>
</html>`
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
}
