import path from "node:path"
import os from "node:os"

export type BrowserLaneSurfaceKind = "selkies-stream" | "direct-iframe"

export type BrowserLaneRuntimeOwnership = "managed-local" | "attached"

export type BrowserLaneDeploymentLocation = "local" | "remote" | "unknown"

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

export interface BrowserLaneLegacySurfaceInput {
	surfaceKind?: BrowserLaneSurfaceKind
	runtime?: "docker-chromium" | "remote-attached"
	cdpEndpoint?: string | null
}

export interface BrowserLane {
	id: string
	label: string
	surfaceKind: BrowserLaneSurfaceKind
	runtimeOwnership: BrowserLaneRuntimeOwnership
	deploymentLocation: BrowserLaneDeploymentLocation
	streamPath: string
	targetUrl: string | null
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
	surfaceKind: BrowserLaneSurfaceKind
	runtimeOwnership: BrowserLaneRuntimeOwnership
	deploymentLocation: BrowserLaneDeploymentLocation
	targetUrl: string | null
	streamBackendUrl: string | null
	cdpEndpoint: string | null
	profilePath: string | null
	host: string | null
	createdAt: number
	updatedAt: number
}

interface LegacyBrowserLaneRecord {
	id: string
	label: string
	mode?: "local" | "remote"
	runtime?: "docker-chromium" | "remote-attached"
	surfaceKind?: BrowserLaneSurfaceKind
	streamBackendUrl: string | null
	cdpEndpoint?: string | null
	profilePath?: string | null
	host?: string | null
	createdAt?: number
	updatedAt?: number
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
export const BROWSER_LANE_REGISTRY_VERSION = 2

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

export function isManagedBrowserLane(
	lane: Pick<BrowserLaneRecord, "runtimeOwnership">,
): boolean {
	return lane.runtimeOwnership === "managed-local"
}

export function isAttachedBrowserLane(
	lane: Pick<BrowserLaneRecord, "runtimeOwnership">,
): boolean {
	return lane.runtimeOwnership === "attached"
}

export function isDirectIframeBrowserLane(
	lane: Pick<BrowserLaneRecord, "surfaceKind">,
): boolean {
	return lane.surfaceKind === "direct-iframe"
}

export function isSelkiesBrowserLane(
	lane: Pick<BrowserLaneRecord, "surfaceKind">,
): boolean {
	return lane.surfaceKind === "selkies-stream"
}

export function assertValidBrowserLaneRecord(record: BrowserLaneRecord): void {
	if (record.surfaceKind === "direct-iframe" && record.runtimeOwnership === "managed-local") {
		throw new Error("direct-iframe lanes must use attached runtime ownership")
	}
	if (record.surfaceKind === "direct-iframe" && !record.targetUrl) {
		throw new Error("direct-iframe lanes require targetUrl")
	}
	if (record.surfaceKind === "direct-iframe" && record.streamBackendUrl) {
		throw new Error("direct-iframe lanes must not set streamBackendUrl")
	}
	if (record.surfaceKind === "selkies-stream" && !record.streamBackendUrl && record.runtimeOwnership === "attached") {
		throw new Error("attached Selkies lanes require streamBackendUrl")
	}
	if (record.surfaceKind === "selkies-stream" && record.targetUrl) {
		throw new Error("selkies-stream lanes must not set targetUrl")
	}
	if (record.runtimeOwnership === "managed-local" && record.deploymentLocation !== "local") {
		throw new Error("managed-local lanes must use local deploymentLocation")
	}
}

export function getBrowserLaneSurfaceUrl(
	lane: Pick<BrowserLaneRecord, "surfaceKind" | "targetUrl" | "streamBackendUrl">,
): string | null {
	return lane.surfaceKind === "direct-iframe" ? lane.targetUrl : lane.streamBackendUrl
}

export function getBrowserLaneSurfaceKind(input: BrowserLaneLegacySurfaceInput): BrowserLaneSurfaceKind {
	if (input.surfaceKind) {
		return input.surfaceKind
	}
	if (input.runtime === "docker-chromium") {
		return "selkies-stream"
	}
	return input.cdpEndpoint ? "selkies-stream" : "direct-iframe"
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

function inferLegacySurfaceKind(record: LegacyBrowserLaneRecord): BrowserLaneSurfaceKind {
	return getBrowserLaneSurfaceKind(record)
}

function inferLegacyRuntimeOwnership(record: LegacyBrowserLaneRecord): BrowserLaneRuntimeOwnership {
	if (record.mode === "local" || record.runtime === "docker-chromium") {
		return "managed-local"
	}
	return "attached"
}

function inferLegacyDeploymentLocation(record: LegacyBrowserLaneRecord): BrowserLaneDeploymentLocation {
	const host = record.host?.trim()
	if (!host) {
		return record.mode === "local" ? "local" : "unknown"
	}
	if (host === "127.0.0.1" || host === "localhost" || host === "::1") {
		return "local"
	}
	return "remote"
}

export function migrateBrowserLaneRecord(
	record: BrowserLaneRecord | LegacyBrowserLaneRecord,
): BrowserLaneRecord {
	if ("runtimeOwnership" in record && "deploymentLocation" in record && "targetUrl" in record) {
		assertValidBrowserLaneRecord(record)
		return record
	}
	const surfaceKind = inferLegacySurfaceKind(record)
	const runtimeOwnership = inferLegacyRuntimeOwnership(record)
	const targetUrl = surfaceKind === "direct-iframe" ? record.streamBackendUrl : null
	const migrated: BrowserLaneRecord = {
		id: record.id,
		label: record.label,
		surfaceKind,
		runtimeOwnership,
		deploymentLocation: inferLegacyDeploymentLocation(record),
		targetUrl,
		streamBackendUrl: surfaceKind === "selkies-stream" ? record.streamBackendUrl : null,
		cdpEndpoint: record.cdpEndpoint ?? null,
		profilePath: record.profilePath ?? null,
		host: record.host ?? null,
		createdAt: record.createdAt ?? Date.now(),
		updatedAt: record.updatedAt ?? record.createdAt ?? Date.now(),
	}
	assertValidBrowserLaneRecord(migrated)
	return migrated
}

export function inflateBrowserLane(record: BrowserLaneRecord, health?: BrowserLaneHealth): BrowserLane {
	assertValidBrowserLaneRecord(record)
	return {
		...record,
		streamPath: getBrowserLaneStreamPath(record.id),
		health: health ?? createEmptyBrowserLaneHealth(),
	}
}
