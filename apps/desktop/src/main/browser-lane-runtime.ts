import fs from "node:fs"
import path from "node:path"
import { getBrowserLaneDataDir, getBrowserLaneProfileRootDir } from "./automation/paths"
import { findFreePort } from "./find-free-port"
import { createLogger } from "./logger"
import type { BrowserLaneCapabilityReport, BrowserLaneRecord } from "../preload/api"

const log = createLogger("browser-lane-runtime")

const IMAGE = "lscr.io/linuxserver/chromium:latest"
const DEFAULT_HOST = "127.0.0.1"
const DEFAULT_AUTH = { user: "abc", password: "abc" }

export interface BrowserLaneRuntimeConfig {
	laneId: string
	host: string
	streamPort: number
	cdpPort: number
	profilePath: string
	runtimeDir: string
	composeFile: string
	envFile: string
	streamBackendUrl: string
	cdpEndpoint: string
	auth: { user: string; password: string }
}

export async function createBrowserLaneRuntimeConfig(
	record: BrowserLaneRecord,
	capabilities: BrowserLaneCapabilityReport,
): Promise<BrowserLaneRuntimeConfig> {
	if (!capabilities.localRuntimeSupported) {
		throw new Error(capabilities.unsupportedReason || "Local browser lane runtime unsupported")
	}
	const streamPort = await findFreePort(DEFAULT_HOST)
	const cdpPort = await findFreePort(DEFAULT_HOST)
	const runtimeDir = path.join(getBrowserLaneDataDir(), record.id)
	const profilePath = record.profilePath || path.join(getBrowserLaneProfileRootDir(), record.id)
	return {
		laneId: record.id,
		host: record.host || DEFAULT_HOST,
		streamPort,
		cdpPort,
		profilePath,
		runtimeDir,
		composeFile: path.join(runtimeDir, "docker-compose.yml"),
		envFile: path.join(runtimeDir, ".env"),
		streamBackendUrl: `http://${DEFAULT_HOST}:${streamPort}`,
		cdpEndpoint: `http://${DEFAULT_HOST}:${cdpPort}`,
		auth: DEFAULT_AUTH,
	}
}

export function ensureBrowserLaneRuntimeFiles(config: BrowserLaneRuntimeConfig): void {
	fs.mkdirSync(config.runtimeDir, { recursive: true })
	fs.mkdirSync(config.profilePath, { recursive: true })
	fs.writeFileSync(
		config.envFile,
		[
			`LANE_ID=${config.laneId}`,
			`STREAM_PORT=${config.streamPort}`,
			`CDP_PORT=${config.cdpPort}`,
			`PROFILE_PATH=${config.profilePath}`,
			`STREAM_AUTH_USER=${config.auth.user}`,
			`STREAM_AUTH_PASSWORD=${config.auth.password}`,
		].join("\n") + "\n",
		"utf-8",
	)
	fs.writeFileSync(config.composeFile, renderBrowserLaneCompose(config), "utf-8")
	log.info("Browser lane runtime files ready", {
		laneId: config.laneId,
		runtimeDir: config.runtimeDir,
		profilePath: config.profilePath,
	})
}

export function renderBrowserLaneCompose(config: BrowserLaneRuntimeConfig): string {
	return [
		"services:",
		`  browser-lane-${config.laneId}:`,
		`    image: ${IMAGE}`,
		"    restart: unless-stopped",
		"    shm_size: \"1gb\"",
		"    environment:",
		`      - CUSTOM_USER=${config.auth.user}`,
		`      - PASSWORD=${config.auth.password}`,
		"      - PUID=1000",
		"      - PGID=1000",
		"      - TZ=UTC",
		"      - CHROME_CLI=",
		"    ports:",
		`      - \"${config.streamPort}:3000\"`,
		`      - \"${config.cdpPort}:9222\"`,
		`      - \"9222:9222\"`,
		"    volumes:",
		`      - ${config.profilePath}:/config`,
		"",
	].join("\n")
}
