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
const DEFAULT_START_URL = "https://example.com"

const CHROMIUM_FLAGS_FILE = path.join(".config", "chromium-flags.conf")
const CHROMIUM_FLAGS_CONTENT = [
	"--no-sandbox",
	"--remote-debugging-port=9222",
	"--remote-allow-origins=*",
].join("\n") + "\n"

const CHROMIUM_SUPERVISOR_CONTENT = [
	"#!/bin/bash",
	"set -e",
	"",
	"CHROMIUM_BIN=/usr/bin/wrapped-chromium",
	"CHROME_USER_DATA_DIR=/tmp/elf-cdp-manual",
	"CDP_PORT=9222",
	'START_URL="${START_URL:-about:blank}"',
	'LOG_PREFIX="[elf-cdp-supervisor]"',
	"",
	'mkdir -p "$CHROME_USER_DATA_DIR"',
	'chmod 700 "$CHROME_USER_DATA_DIR"',
	"",
	"launch_chromium() {",
	'  echo "$LOG_PREFIX launching Chromium..."',
	'  pkill -f "remote-debugging-port=$CDP_PORT" 2>/dev/null || true',
	'  rm -f "$CHROME_USER_DATA_DIR/SingletonLock" "$CHROME_USER_DATA_DIR/SingletonSocket" 2>/dev/null || true',
	"",
	'  "$CHROMIUM_BIN" \\',
	'    --headless=new \\',
	'    --remote-debugging-address=0.0.0.0 \\',
	'    --remote-debugging-port=$CDP_PORT \\',
	'    --remote-allow-origins=* \\',
	'    --user-data-dir="$CHROME_USER_DATA_DIR" \\',
	'    --disable-gpu \\',
	'    "$START_URL" >/tmp/elf-cdp-chromium.log 2>&1 &',
	"",
	'  CHROME_PID=$!',
	'  echo "$LOG_PREFIX Chromium PID $CHROME_PID"',
	"}",
	"",
	"stream_logs() {",
	'  if [ -f /tmp/elf-cdp-chromium.log ]; then',
	'    cat /tmp/elf-cdp-chromium.log >&2 || true',
	"  fi",
	"}",
	"",
	"wait_for_cdp() {",
	"  local attempt=1",
	"  local max_attempts=60",
	"  while [ $attempt -le $max_attempts ]; do",
	'    if curl -sf --max-time 2 "http://127.0.0.1:$CDP_PORT/json/version" >/dev/null 2>&1; then',
	'      echo "$LOG_PREFIX CDP ready after ${attempt}s"',
	"      return 0",
	"    fi",
	'    if ! kill -0 "$CHROME_PID" 2>/dev/null; then',
	'      echo "$LOG_PREFIX Chromium died before CDP became ready"',
	"      stream_logs",
	"      return 1",
	"    fi",
	"    sleep 1",
	"    attempt=$((attempt + 1))",
	"  done",
	'  echo "$LOG_PREFIX CDP never appeared after ${max_attempts}s"',
	"  stream_logs",
	"  return 1",
	"}",
	"",
	"while true; do",
	"  launch_chromium",
	"  wait_for_cdp || true",
	'  wait "$CHROME_PID" 2>/dev/null || true',
	"  sleep 2",
	"done",
	"",
].join("\n")

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
	cdpContainerEndpoint: string
	auth: { user: string; password: string }
	startUrl: string
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
		cdpContainerEndpoint: "http://127.0.0.1:9222",
		auth: DEFAULT_AUTH,
		startUrl:
			record.targetUrl || process.env.ELF_BROWSER_LANE_START_URL?.trim() || DEFAULT_START_URL,
	}
}

export function ensureBrowserLaneRuntimeFiles(config: BrowserLaneRuntimeConfig): void {
	fs.mkdirSync(config.runtimeDir, { recursive: true })
	fs.mkdirSync(config.profilePath, { recursive: true })
	const flagsFile = path.join(config.profilePath, CHROMIUM_FLAGS_FILE)
	fs.mkdirSync(path.dirname(flagsFile), { recursive: true })
	fs.writeFileSync(flagsFile, CHROMIUM_FLAGS_CONTENT, "utf-8")
	const supervisorScriptPath = path.join(config.runtimeDir, "elf-cdp-supervisor.sh")
	const supervisorContainerPath = "/custom-cont-init.d/elf-cdp-supervisor.sh"
	fs.writeFileSync(supervisorScriptPath, CHROMIUM_SUPERVISOR_CONTENT, "utf-8")
	fs.chmodSync(supervisorScriptPath, 0o755)
	fs.writeFileSync(
		config.envFile,
		[
			`LANE_ID=${config.laneId}`,
			`STREAM_PORT=${config.streamPort}`,
			`CDP_PORT=${config.cdpPort}`,
			`PROFILE_PATH=${config.profilePath}`,
			`STREAM_AUTH_USER=${config.auth.user}`,
			`STREAM_AUTH_PASSWORD=${config.auth.password}`,
			`START_URL=${config.startUrl}`,
			`CDP_CONTAINER_ENDPOINT=${config.cdpContainerEndpoint}`,
		].join("\n") + "\n",
		"utf-8",
	)
	fs.writeFileSync(config.composeFile, renderBrowserLaneCompose(config, supervisorContainerPath), "utf-8")
	log.info("Browser lane runtime files ready", {
		laneId: config.laneId,
		runtimeDir: config.runtimeDir,
		profilePath: config.profilePath,
		flagsFile,
		supervisorScriptPath,
	})
}

export function renderBrowserLaneCompose(
	config: BrowserLaneRuntimeConfig,
	supervisorScriptPath: string,
): string {
	return [
		"services:",
		`  browser-lane-${config.laneId}:`,
		`    image: ${IMAGE}`,
		"    restart: unless-stopped",
		"    shm_size: \"1gb\"",
		"    entrypoint:",
		`      - "${supervisorScriptPath}"`,
		"    environment:",
		`      - CUSTOM_USER=${config.auth.user}`,
		`      - PASSWORD=${config.auth.password}`,
		"      - PUID=1000",
		"      - PGID=1000",
		"      - TZ=UTC",
		"      - TITLE=Elf Browser Lane",
		"      - NO_DECOR=1",
		"      - SELKIES_SCALING_DPI=96",
		"      - DOCKER_MODS=linuxserver/mods:universal-package-install",
		"      - INSTALL_PACKAGES=chromium",
		"      - SELKIES_SHOW_SIDEBAR=false",
		"      - SELKIES_SHOW_ICON=false",
		"      - CUSTOM_VERSION=stable",
		"      - START_URL=" + config.startUrl,
		"    ports:",
		`      - "${config.streamPort}:3000"`,
		`      - "${config.cdpPort}:9222"`,
		"    volumes:",
		`      - ${config.profilePath}:/config`,
		`      - ${config.runtimeDir}:/custom-cont-init.d`,
		"",
	].join("\n")
}

export function chromeCliForConfig(config: BrowserLaneRuntimeConfig): string {
	return [
		"--remote-debugging-port=9222",
		"--remote-allow-origins=*",
		"--no-first-run",
		"--disable-session-crashed-bubble",
		"--start-maximized",
		`--app=${config.startUrl}`,
	].join(" ")
}
