import path from "node:path"
import os from "node:os"

export type BrowserLaneMode = "local" | "remote"

export type BrowserLaneRuntime = "docker-chromium" | "remote-attached"

export type BrowserLaneSurfaceKind = "selkies-stream" | "direct-iframe"

export type BrowserLaneStatus =
	| "installing"
	| "starting"
	| "running"
	| "degraded"
	| "stopped"
	| "error"
	| "profile-locked"

export type BrowserLaneReadiness = "unknown" | "pending" | "ready" | "failed" | "not-applicable"

export interface BrowserLaneEndpoint {
	url: string | null
	checkedAt: number | null
	state: BrowserLaneReadiness
	error: string | null
}

export interface BrowserLaneHealth {
	status: BrowserLaneStatus
	stream: BrowserLaneEndpoint
	cdp: BrowserLaneEndpoint
	message: string
}

export interface BrowserLane {
	id: string
	label: string
	mode: BrowserLaneMode
	runtime: BrowserLaneRuntime
	surfaceKind: BrowserLaneSurfaceKind
	streamPath: string
	streamBackendUrl: string | null
	cdpEndpoint: string | null
	profilePath: string | null
	host: string | null
	createdAt: number
	updatedAt: number
	health: BrowserLaneHealth
}

export interface BrowserLaneRecord {
	id: string
	label: string
	mode: BrowserLaneMode
	runtime: BrowserLaneRuntime
	surfaceKind?: BrowserLaneSurfaceKind
	streamBackendUrl: string | null
	cdpEndpoint: string | null
	profilePath: string | null
	host: string | null
	createdAt: number
	updatedAt: number
}

export interface BrowserLanePaths {
	configDir: string
	dataDir: string
	lanesDir: string
	recordFile: string
	runtimeDir: string
	profileRootDir: string
	profileDir: string
	composeFile: string
	envFile: string
}

export interface BrowserLaneCapabilityReport {
	platform: NodeJS.Platform
	localRuntimeSupported: boolean
	remoteAttachSupported: boolean
	docker: {
		installed: boolean
		version: string | null
	}
	compose: {
		available: boolean
		command: "docker compose" | "docker-compose" | null
		version: string | null
	}
	unsupportedReason: string | null
	remediation: string | null
}

export const DEFAULT_BROWSER_LANE_ID = "default"
export const BROWSER_LANE_RECORD_FILE = "lanes.json"
export const BROWSER_LANE_RUNTIME_DIR = "browser-lanes"

export function isValidBrowserLaneId(laneId: string): boolean {
	return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(laneId)
}

export function assertValidBrowserLaneId(laneId: string): void {
	if (!isValidBrowserLaneId(laneId)) {
		throw new Error(
			`Invalid browser lane id \"${laneId}\". Use lowercase letters, numbers, or hyphens.`,
		)
	}
}

export function getBrowserLaneStreamPath(laneId: string): string {
	assertValidBrowserLaneId(laneId)
	return `/browser/${laneId}/`
}

export function getBrowserLaneStoragePaths(laneId: string): BrowserLanePaths {
	assertValidBrowserLaneId(laneId)
	const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config")
	const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share")
	const configDir = path.join(xdgConfig, "elf")
	const dataDir = path.join(xdgData, "elf")
	const lanesDir = path.join(configDir, "browser-lanes")
	const runtimeDir = path.join(dataDir, BROWSER_LANE_RUNTIME_DIR)
	const profileRootDir = path.join(dataDir, "browser-profiles")
	const profileDir = path.join(profileRootDir, laneId)
	return {
		configDir,
		dataDir,
		lanesDir,
		recordFile: path.join(lanesDir, BROWSER_LANE_RECORD_FILE),
		runtimeDir,
		profileRootDir,
		profileDir,
		composeFile: path.join(runtimeDir, laneId, "docker-compose.yml"),
		envFile: path.join(runtimeDir, laneId, ".env"),
	}
}

export function summarizeBrowserLaneHealth(health: BrowserLaneHealth): string {
	if (
		health.status === "running" &&
		health.stream.state === "ready" &&
		(health.cdp.state === "ready" || health.cdp.state === "not-applicable")
	) {
		return health.cdp.state === "not-applicable" ? "Direct iframe ready" : "Stream and CDP ready"
	}
	if (health.stream.state === "ready" && health.cdp.state === "not-applicable") {
		return "Direct iframe ready"
	}
	if (health.stream.state === "ready" && health.cdp.state === "pending") {
		return "Stream ready, CDP still starting"
	}
	if (health.stream.state === "ready" && health.cdp.state === "failed") {
		return "Stream ready, CDP unavailable"
	}
	if (health.stream.state === "failed" && health.cdp.state === "ready") {
		return "CDP ready, stream unavailable"
	}
	if (health.status === "profile-locked") {
		return health.message || "Profile locked"
	}
	if (health.status === "error") {
		return health.message || "Browser lane error"
	}
	if (health.status === "stopped") {
		return "Lane stopped"
	}
	if (health.status === "starting" || health.status === "installing") {
		return health.message || "Lane starting"
	}
	return health.message || "Lane status unknown"
}

export function createEmptyBrowserLaneHealth(
	status: BrowserLaneStatus = "stopped",
	message?: string,
): BrowserLaneHealth {
	return {
		status,
		stream: {
			url: null,
			checkedAt: null,
			state: "unknown",
			error: null,
		},
		cdp: {
			url: null,
			checkedAt: null,
			state: "unknown",
			error: null,
		},
		message: message || (status === "stopped" ? "Lane stopped" : ""),
	}
}

export function getBrowserLaneSurfaceKind(record: Pick<BrowserLaneRecord, "runtime" | "surfaceKind" | "cdpEndpoint">): BrowserLaneSurfaceKind {
	if (record.surfaceKind) {
		return record.surfaceKind
	}
	// docker-chromium streams via selkies; everything else defaults to direct-iframe.
	// Selkies-stream is opt-in for remote lanes that explicitly supply a streamBackendUrl + cdpEndpoint.
	if (record.runtime === "docker-chromium") {
		return "selkies-stream"
	}
	return "direct-iframe"
}

export function inflateBrowserLane(record: BrowserLaneRecord, health?: BrowserLaneHealth): BrowserLane {
	return {
		...record,
		surfaceKind: getBrowserLaneSurfaceKind(record),
		streamPath: getBrowserLaneStreamPath(record.id),
		health: health ?? createEmptyBrowserLaneHealth(),
	}
}
