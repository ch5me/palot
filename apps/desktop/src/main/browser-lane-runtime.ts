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

// LinuxServer/Selkies Chromium ignores CHROME_CLI for --remote-debugging-port,
// so the image is configured via a custom-cont-init.d/ script that patches the
// wrapped-chromium launcher in place to append the CDP flags. The s6-overlay
// init runs everything in /custom-cont-init.d/ in lexical order before the
// selkies service starts.
const CHROMIUM_FLAGS_FILE = path.join(".config", "chromium-flags.conf")
const CHROMIUM_FLAGS_CONTENT = [
	"--no-sandbox",
	"--remote-debugging-port=0.0.0.0:9222",
	"--remote-allow-origins=*",
].join("\n") + "\n"
const INIT_CDP_SCRIPT_CONTENT = `#!/usr/bin/with-contenv bash
# Patch wrapped-chromium so the CDP-enabling flags reach the chromium binary.
# The upstream wrapper only honours flags it knows about; CHROME_CLI and the
# chromium-flags.conf file both get filtered out for --remote-debugging-port.
# We rewrite the wrapper to a CDP-enabled equivalent rather than try to splice
# into the upstream multi-line shell-continued command.
set -e
WRAPPER=/usr/bin/wrapped-chromium
if [ ! -f "$WRAPPER" ]; then
  echo "[elf-cdp] $WRAPPER not found; nothing to patch" >&2
  exit 0
fi
if grep -q -- "--remote-debugging-port" "$WRAPPER"; then
  echo "[elf-cdp] CDP flags already present in $WRAPPER" >&2
  exit 0
fi
cat > "$WRAPPER" <<'WRAPPER_EOF'
#!/bin/bash

BIN=/usr/bin/chromium

# Cleanup
if ! pgrep chromium > /dev/null;then
  rm -f $HOME/.config/chromium/Singleton*
fi

# Run normally on privved containers or modified un non priv
if grep -q 'Seccomp:.0' /proc/1/status; then
  \${BIN} \\
  --no-first-run \\
  --password-store=basic \\
  --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \\
  --start-maximized \\
  --user-data-dir \\
  --remote-debugging-port=0.0.0.0:9222 \\
  --remote-allow-origins=* \\
   "\$@" > /dev/null 2>&1
else
  \${BIN} \\
  --no-first-run \\
  --no-sandbox \\
  --password-store=basic \\
  --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \\
  --start-maximized \\
  --test-type \\
  --user-data-dir \\
  --remote-debugging-port=0.0.0.0:9222 \\
  --remote-allow-origins=* \\
   "\$@" > /dev/null 2>&1
fi
WRAPPER_EOF
chmod +x "$WRAPPER"
echo "[elf-cdp] Patched $WRAPPER to enable CDP" >&2
`

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
	const flagsFile = path.join(config.profilePath, CHROMIUM_FLAGS_FILE)
	fs.mkdirSync(path.dirname(flagsFile), { recursive: true })
	fs.writeFileSync(flagsFile, CHROMIUM_FLAGS_CONTENT, "utf-8")
	const initDir = path.join(config.runtimeDir, "custom-cont-init.d")
	fs.mkdirSync(initDir, { recursive: true })
	fs.writeFileSync(path.join(initDir, "10-enable-cdp.sh"), INIT_CDP_SCRIPT_CONTENT, "utf-8")
	fs.chmodSync(path.join(initDir, "10-enable-cdp.sh"), 0o755)
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
		flagsFile,
		initDir,
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
		`      - ${path.join(config.runtimeDir, "custom-cont-init.d")}:/custom-cont-init.d`,
		"",
	].join("\n")
}
