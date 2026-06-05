import fs from "node:fs"
import path from "node:path"
import {
	createEmptyBrowserLaneHealth,
	DEFAULT_BROWSER_LANE_ID,
	inflateBrowserLane,
	type BrowserLaneHealth,
	type BrowserLaneRecord,
} from "../shared/browser-lanes"
import type { BrowserLane } from "../renderer/lib/types"
import { getBrowserLaneDesktopUrl } from "./browser-lane-protocol"
import type {
	BrowserLaneMode,
	BrowserLaneRuntime,
	CreateRemoteBrowserLaneInput,
} from "../preload/api"
import {
	createBrowserLaneRuntimeConfig,
	ensureBrowserLaneRuntimeFiles,
	type BrowserLaneRuntimeConfig,
} from "./browser-lane-runtime"
import { detectBrowserLaneCapabilities } from "./browser-lane-capabilities"
import {
	buildHealthFromProbe,
	probeBrowserLaneEndpoints,
	runBrowserLaneCompose,
} from "./browser-lane-process"
import { getBrowserLaneConfigDir } from "./automation/paths"
const REGISTRY_FILE = path.join(getBrowserLaneConfigDir(), "lanes.json")
const LOCAL_LANE_AUTH = { user: "abc", password: "abc" }

interface BrowserLaneRegistryFile {
	version: 1
	lanes: BrowserLaneRecord[]
}

interface LaneRuntimeState {
	health: BrowserLaneHealth
	runtimeConfig: BrowserLaneRuntimeConfig | null
	lastError: string | null
	inFlight: Promise<BrowserLane> | null
	profileResetAt: number | null
}

const laneState = new Map<string, LaneRuntimeState>()
let initialized = false

function createDefaultRecord(): BrowserLaneRecord {
	const now = Date.now()
	return {
		id: DEFAULT_BROWSER_LANE_ID,
		label: "Default",
		mode: "local",
		runtime: "docker-chromium",
		streamBackendUrl: null,
		cdpEndpoint: null,
		profilePath: null,
		host: "127.0.0.1",
		createdAt: now,
		updatedAt: now,
	}
}

function ensureRegistryDir(): void {
	fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true })
}

function readRegistryFile(): BrowserLaneRegistryFile {
	ensureRegistryDir()
	if (!fs.existsSync(REGISTRY_FILE)) {
		return { version: 1, lanes: [createDefaultRecord()] }
	}
	const raw = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf-8")) as BrowserLaneRegistryFile
	if (!Array.isArray(raw.lanes) || raw.lanes.length === 0) {
		return { version: 1, lanes: [createDefaultRecord()] }
	}
	return { version: 1, lanes: raw.lanes }
}

function writeRegistryFile(data: BrowserLaneRegistryFile): void {
	ensureRegistryDir()
	const tmpPath = `${REGISTRY_FILE}.tmp`
	fs.writeFileSync(tmpPath, JSON.stringify(data, null, "\t"), "utf-8")
	fs.renameSync(tmpPath, REGISTRY_FILE)
}

function getLaneState(id: string): LaneRuntimeState {
	let state = laneState.get(id)
	if (!state) {
		state = {
			health: createEmptyBrowserLaneHealth(),
			runtimeConfig: null,
			lastError: null,
			inFlight: null,
			profileResetAt: null,
		}
		laneState.set(id, state)
	}
	return state
}

function setLaneHealth(id: string, health: BrowserLaneHealth): void {
	getLaneState(id).health = health
}

function buildProfileLockMessage(profilePath: string | null, resetAt: number | null): string {
	if (resetAt) {
		return `Profile reset at ${new Date(resetAt).toISOString()}. Restart lane to create a clean session.`
	}
	if (profilePath) {
		return `Profile exists at ${profilePath}. Restart reuses it unless you reset profile.`
	}
	return "Profile exists but runtime has not started yet"
}

function buildHealth(input: {
	status: BrowserLaneHealth["status"]
	message: string
	streamUrl: string | null
	streamState: BrowserLaneHealth["stream"]["state"]
	streamError?: string | null
	cdpUrl: string | null
	cdpState: BrowserLaneHealth["cdp"]["state"]
	cdpError?: string | null
}): BrowserLaneHealth {
	const checkedAt = Date.now()
	return {
		status: input.status,
		stream: {
			url: input.streamUrl,
			checkedAt,
			state: input.streamState,
			error: input.streamError ?? null,
		},
		cdp: {
			url: input.cdpUrl,
			checkedAt,
			state: input.cdpState,
			error: input.cdpError ?? null,
		},
		message: input.message,
	}
}

function toBrowserLane(record: BrowserLaneRecord): BrowserLane {
	return {
		...inflateBrowserLane(record, getLaneState(record.id).health),
		desktopStreamUrl: getBrowserLaneDesktopUrl(record.id),
	}
}

function updateRecord(id: string, updater: (record: BrowserLaneRecord) => BrowserLaneRecord): BrowserLaneRecord | null {
	const registry = readRegistryFile()
	const index = registry.lanes.findIndex((lane) => lane.id === id)
	if (index === -1) return null
	registry.lanes[index] = updater(registry.lanes[index]!)
	writeRegistryFile(registry)
	return registry.lanes[index]!
}

async function withLaneLock(id: string, run: () => Promise<BrowserLane>): Promise<BrowserLane> {
	const state = getLaneState(id)
	if (state.inFlight) return await state.inFlight
	state.inFlight = run().finally(() => {
		state.inFlight = null
	})
	return await state.inFlight
}

export async function initBrowserLaneManager(): Promise<void> {
	if (initialized) return
	const registry = readRegistryFile()
	writeRegistryFile(registry)
	for (const lane of registry.lanes) {
		getLaneState(lane.id)
	}
	initialized = true
}

export async function shutdownBrowserLaneManager(): Promise<void> {
	laneState.clear()
	initialized = false
}

export async function listBrowserLanes(): Promise<BrowserLane[]> {
	await initBrowserLaneManager()
	return readRegistryFile().lanes.map(toBrowserLane)
}

export async function getBrowserLane(id: string): Promise<BrowserLane | null> {
	await initBrowserLaneManager()
	const record = readRegistryFile().lanes.find((lane) => lane.id === id)
	return record ? toBrowserLane(record) : null
}

export async function createRemoteBrowserLane(input: CreateRemoteBrowserLaneInput): Promise<BrowserLane> {
	return await createBrowserLane({
		id: input.id,
		label: input.label,
		mode: "remote",
		runtime: "remote-attached",
		streamBackendUrl: input.streamBackendUrl,
		cdpEndpoint: input.cdpEndpoint,
		host: input.host ?? null,
		profilePath: input.profilePath ?? null,
	})
}

export async function createBrowserLane(input: {
	id: string
	label: string
	mode: BrowserLaneMode
	runtime: BrowserLaneRuntime
	host?: string | null
	streamBackendUrl?: string | null
	cdpEndpoint?: string | null
	profilePath?: string | null
}): Promise<BrowserLane> {
	await initBrowserLaneManager()
	const registry = readRegistryFile()
	const now = Date.now()
	const record: BrowserLaneRecord = {
		id: input.id,
		label: input.label,
		mode: input.mode,
		runtime: input.runtime,
		streamBackendUrl: input.streamBackendUrl ?? null,
		cdpEndpoint: input.cdpEndpoint ?? null,
		profilePath: input.profilePath ?? null,
		host: input.host ?? "127.0.0.1",
		createdAt: now,
		updatedAt: now,
	}
	registry.lanes = registry.lanes.filter((lane) => lane.id !== record.id)
	registry.lanes.push(record)
	writeRegistryFile(registry)
	return toBrowserLane(record)
}

export async function ensureBrowserLane(
	id: string,
	options: { autostart?: boolean } = {},
): Promise<BrowserLane> {
	await initBrowserLaneManager()
	return await withLaneLock(id, async () => {
		const lane = await getBrowserLane(id)
		if (!lane) throw new Error(`Browser lane ${id} not found`)
		if (lane.mode === "remote") {
			setLaneHealth(
				id,
				buildHealth({
					status: lane.streamBackendUrl ? "degraded" : "error",
					message: lane.streamBackendUrl
						? lane.cdpEndpoint
							? "Remote stream attached, CDP ready"
							: "Remote stream attached, CDP unavailable"
						: "Remote lane not configured",
					streamUrl: lane.streamBackendUrl,
					streamState: lane.streamBackendUrl ? "ready" : "failed",
					streamError: lane.streamBackendUrl ? null : "Stream backend URL missing",
					cdpUrl: lane.cdpEndpoint,
					cdpState: lane.cdpEndpoint ? "ready" : "failed",
					cdpError: lane.cdpEndpoint ? null : "CDP endpoint missing",
				}),
			)
			return await getBrowserLane(id).then((entry) => {
				if (!entry) throw new Error(`Browser lane ${id} disappeared during ensure`)
				return entry
			})
		}
		setLaneHealth(
			id,
			buildHealth({
				status: "installing",
				message: "Preparing browser lane runtime",
				streamUrl: lane.streamBackendUrl,
				streamState: "pending",
				cdpUrl: lane.cdpEndpoint,
				cdpState: "pending",
			}),
		)
		const capabilities = await detectBrowserLaneCapabilities()
		const config = await createBrowserLaneRuntimeConfig(lane, capabilities)
		ensureBrowserLaneRuntimeFiles(config)
		const updated = updateRecord(id, (record) => ({
			...record,
			streamBackendUrl: config.streamBackendUrl,
			cdpEndpoint: config.cdpEndpoint,
			profilePath: config.profilePath,
			host: config.host,
			updatedAt: Date.now(),
		}))
		getLaneState(id).profileResetAt = null
		if (!updated) throw new Error(`Browser lane ${id} disappeared during ensure`)
		getLaneState(id).runtimeConfig = config
		setLaneHealth(
			id,
			buildHealth({
				status: "stopped",
				message: "Lane runtime prepared",
				streamUrl: config.streamBackendUrl,
				streamState: "unknown",
				cdpUrl: config.cdpEndpoint,
				cdpState: "unknown",
			}),
		)
		const ensured = toBrowserLane(updated)
		return options.autostart ? await startBrowserLane(id) : ensured
	})
}

export async function startBrowserLane(id: string): Promise<BrowserLane> {
	await initBrowserLaneManager()
	return await withLaneLock(id, async () => {
		const lane = (await ensureBrowserLane(id))
		const state = getLaneState(id)
		const config = state.runtimeConfig
		if (!config) {
			throw new Error(`Browser lane ${id} has no runtime config; ensure failed to populate it`)
		}
		const capabilities = await detectBrowserLaneCapabilities()
		if (!capabilities.compose.command) {
			setLaneHealth(
				id,
				buildHealth({
					status: "error",
					message: capabilities.unsupportedReason || "Docker Compose not available",
					streamUrl: lane.streamBackendUrl,
					streamState: "failed",
					cdpUrl: lane.cdpEndpoint,
					cdpState: "failed",
				}),
			)
			return toBrowserLane(readRegistryFile().lanes.find((entry) => entry.id === id)!)
		}
		setLaneHealth(
			id,
			buildHealth({
				status: "starting",
				message: "Starting browser lane stream and CDP runtime",
				streamUrl: lane.streamBackendUrl,
				streamState: "pending",
				cdpUrl: lane.cdpEndpoint,
				cdpState: "pending",
			}),
		)
		const result = await runBrowserLaneCompose(capabilities.compose.command, config.composeFile, "up")
		if (!result.ok) {
			setLaneHealth(
				id,
				buildHealth({
					status: "error",
					message: `docker compose up failed: ${result.stderr || result.error || `exit ${result.code}`}`,
					streamUrl: lane.streamBackendUrl,
					streamState: "failed",
					streamError: result.stderr || result.error,
					cdpUrl: lane.cdpEndpoint,
					cdpState: "failed",
				}),
			)
			return toBrowserLane(readRegistryFile().lanes.find((entry) => entry.id === id)!)
		}
		const probe = await probeBrowserLaneEndpoints({
			streamUrl: lane.streamBackendUrl,
			cdpUrl: lane.cdpEndpoint,
			auth: LOCAL_LANE_AUTH,
		})
		const probeState = getLaneState(id)
		setLaneHealth(
			id,
			buildHealthFromProbe({
				streamUrl: lane.streamBackendUrl,
				cdpUrl: lane.cdpEndpoint,
				streamReady: probe.streamReady,
				cdpReady: probe.cdpReady,
				streamError: probe.streamError,
				cdpError: probe.cdpError,
				mode: lane.mode,
				profilePath: lane.profilePath,
				profileResetAt: probeState.profileResetAt,
			}),
		)
		return toBrowserLane(readRegistryFile().lanes.find((entry) => entry.id === id)!)
	})
}

export async function stopBrowserLane(id: string): Promise<BrowserLane> {
	await initBrowserLaneManager()
	const lane = await getBrowserLane(id)
	if (!lane) throw new Error(`Browser lane ${id} not found`)
	const state = getLaneState(id)
	if (lane.mode === "local" && state.runtimeConfig) {
		const capabilities = await detectBrowserLaneCapabilities()
		if (capabilities.compose.command) {
			const result = await runBrowserLaneCompose(
				capabilities.compose.command,
				state.runtimeConfig.composeFile,
				"down",
			)
			if (!result.ok) {
				setLaneHealth(
					id,
					buildHealth({
						status: "error",
						message: `docker compose down failed: ${result.stderr || result.error || `exit ${result.code}`}`,
						streamUrl: lane.streamBackendUrl,
						streamState: "failed",
						streamError: result.stderr || result.error,
						cdpUrl: lane.cdpEndpoint,
						cdpState: "failed",
					}),
				)
				return toBrowserLane(readRegistryFile().lanes.find((entry) => entry.id === id)!)
			}
		}
	}
	setLaneHealth(
		id,
		buildHealth({
			status: lane.profilePath ? "profile-locked" : "stopped",
			message: lane.profilePath ? buildProfileLockMessage(lane.profilePath, state.profileResetAt) : "Lane stopped",
			streamUrl: lane.streamBackendUrl,
			streamState: "unknown",
			cdpUrl: lane.cdpEndpoint,
			cdpState: "unknown",
		}),
	)
	return toBrowserLane(readRegistryFile().lanes.find((entry) => entry.id === id)!)
}

export async function resetBrowserLaneProfile(id: string): Promise<BrowserLane> {
	await initBrowserLaneManager()
	const lane = await getBrowserLane(id)
	if (!lane) throw new Error(`Browser lane ${id} not found`)
	if (!lane.profilePath) {
		throw new Error(`Browser lane ${id} has no profile to reset`)
	}
	fs.rmSync(lane.profilePath, { recursive: true, force: true })
	fs.mkdirSync(lane.profilePath, { recursive: true })
	const state = getLaneState(id)
	state.profileResetAt = Date.now()
	setLaneHealth(
		id,
		buildHealth({
			status: "profile-locked",
			message: buildProfileLockMessage(lane.profilePath, state.profileResetAt),
			streamUrl: lane.streamBackendUrl,
			streamState: "unknown",
			cdpUrl: lane.cdpEndpoint,
			cdpState: "unknown",
		}),
	)
	const updated = updateRecord(id, (record) => ({
		...record,
		updatedAt: Date.now(),
	}))
	if (!updated) throw new Error(`Browser lane ${id} disappeared during profile reset`)
	return toBrowserLane(updated)
}

export async function restartBrowserLane(id: string): Promise<BrowserLane> {
	await stopBrowserLane(id)
	return await startBrowserLane(id)
}

export async function refreshBrowserLaneHealth(id: string): Promise<BrowserLaneHealth> {
	await initBrowserLaneManager()
	const lane = await getBrowserLane(id)
	if (!lane) throw new Error(`Browser lane ${id} not found`)
	const state = getLaneState(id)
	const health: BrowserLaneHealth = await (async () => {
		if (lane.mode === "local") {
			const probe = await probeBrowserLaneEndpoints({
				streamUrl: lane.streamBackendUrl,
				cdpUrl: lane.cdpEndpoint,
				auth: LOCAL_LANE_AUTH,
			})
			return buildHealthFromProbe({
				streamUrl: lane.streamBackendUrl,
				cdpUrl: lane.cdpEndpoint,
				streamReady: probe.streamReady,
				cdpReady: probe.cdpReady,
				streamError: probe.streamError,
				cdpError: probe.cdpError,
				mode: lane.mode,
				profilePath: lane.profilePath,
				profileResetAt: state.profileResetAt,
			})
		}
		if (lane.streamBackendUrl && lane.cdpEndpoint) {
			return buildHealth({
				status: "degraded",
				message: "Remote lane attached and reachable",
				streamUrl: lane.streamBackendUrl,
				streamState: "ready",
				cdpUrl: lane.cdpEndpoint,
				cdpState: "ready",
			})
		}
		if (lane.streamBackendUrl) {
			return buildHealth({
				status: "degraded",
				message: "Stream route ready, CDP unavailable",
				streamUrl: lane.streamBackendUrl,
				streamState: "ready",
				cdpUrl: lane.cdpEndpoint,
				cdpState: "failed",
				cdpError: "CDP endpoint missing",
			})
		}
		if (lane.cdpEndpoint) {
			return buildHealth({
				status: "degraded",
				message: "CDP ready, stream unavailable",
				streamUrl: lane.streamBackendUrl,
				streamState: "failed",
				streamError: "Stream backend URL missing",
				cdpUrl: lane.cdpEndpoint,
				cdpState: "ready",
			})
		}
		return buildHealth({
			status: lane.mode === "remote" ? "error" : lane.profilePath ? "profile-locked" : "stopped",
			message:
				lane.mode === "remote"
					? "Remote lane unreachable or not configured"
					: lane.profilePath
						? buildProfileLockMessage(lane.profilePath, state.profileResetAt)
						: "Lane stopped",
			streamUrl: lane.streamBackendUrl,
			streamState: lane.mode === "remote" ? "failed" : "unknown",
			streamError: lane.mode === "remote" ? "Stream backend URL missing" : null,
			cdpUrl: lane.cdpEndpoint,
			cdpState: lane.mode === "remote" ? "failed" : "unknown",
			cdpError: lane.mode === "remote" ? "CDP endpoint missing" : null,
		})
	})()
	setLaneHealth(id, health)
	return health
}

export async function refreshAllBrowserLaneHealths(): Promise<BrowserLane[]> {
	const lanes = await listBrowserLanes()
	for (const lane of lanes) {
		await refreshBrowserLaneHealth(lane.id)
	}
	return await listBrowserLanes()
}
