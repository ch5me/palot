import path from "node:path";
import os from "node:os";
export const DEFAULT_BROWSER_LANE_ID = "default";
export const BROWSER_LANE_RECORD_FILE = "lanes.json";
export const BROWSER_LANE_RUNTIME_DIR = "browser-lanes";
export const BROWSER_LANE_REGISTRY_VERSION = 2;
export function isValidBrowserLaneId(laneId) {
    return /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(laneId);
}
export function assertValidBrowserLaneId(laneId) {
    if (!isValidBrowserLaneId(laneId)) {
        throw new Error(`Invalid browser lane id \"${laneId}\". Use lowercase letters, numbers, or hyphens.`);
    }
}
export function getBrowserLaneStreamPath(laneId) {
    assertValidBrowserLaneId(laneId);
    return `/browser/${laneId}/`;
}
export function getBrowserLaneStoragePaths(laneId) {
    assertValidBrowserLaneId(laneId);
    const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
    const xdgData = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
    const configDir = path.join(xdgConfig, "elf");
    const dataDir = path.join(xdgData, "elf");
    const lanesDir = path.join(configDir, "browser-lanes");
    const runtimeDir = path.join(dataDir, BROWSER_LANE_RUNTIME_DIR);
    const profileRootDir = path.join(dataDir, "browser-profiles");
    const profileDir = path.join(profileRootDir, laneId);
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
    };
}
export function isManagedBrowserLane(lane) {
    return lane.runtimeOwnership === "managed-local";
}
export function isAttachedBrowserLane(lane) {
    return lane.runtimeOwnership === "attached";
}
export function isDirectIframeBrowserLane(lane) {
    return lane.surfaceKind === "direct-iframe";
}
export function isSelkiesBrowserLane(lane) {
    return lane.surfaceKind === "selkies-stream";
}
export function assertValidBrowserLaneRecord(record) {
    if (record.surfaceKind === "direct-iframe" && record.runtimeOwnership === "managed-local") {
        throw new Error("direct-iframe lanes must use attached runtime ownership");
    }
    if (record.surfaceKind === "direct-iframe" && !record.targetUrl) {
        throw new Error("direct-iframe lanes require targetUrl");
    }
    if (record.surfaceKind === "direct-iframe" && record.streamBackendUrl) {
        throw new Error("direct-iframe lanes must not set streamBackendUrl");
    }
    if (record.surfaceKind === "selkies-stream" && !record.streamBackendUrl && record.runtimeOwnership === "attached") {
        throw new Error("attached Selkies lanes require streamBackendUrl");
    }
    if (record.surfaceKind === "selkies-stream" && record.targetUrl) {
        throw new Error("selkies-stream lanes must not set targetUrl");
    }
    if (record.runtimeOwnership === "managed-local" && record.deploymentLocation !== "local") {
        throw new Error("managed-local lanes must use local deploymentLocation");
    }
}
export function getBrowserLaneSurfaceUrl(lane) {
    return lane.surfaceKind === "direct-iframe" ? lane.targetUrl : lane.streamBackendUrl;
}
export function getBrowserLaneSurfaceKind(input) {
    if (input.surfaceKind) {
        return input.surfaceKind;
    }
    if (input.runtime === "docker-chromium") {
        return "selkies-stream";
    }
    return input.cdpEndpoint ? "selkies-stream" : "direct-iframe";
}
export function summarizeBrowserLaneHealth(health) {
    if (health.status === "running" &&
        health.stream.state === "ready" &&
        (health.cdp.state === "ready" || health.cdp.state === "not-applicable")) {
        return health.cdp.state === "not-applicable" ? "Direct iframe ready" : "Stream and CDP ready";
    }
    if (health.stream.state === "ready" && health.cdp.state === "not-applicable") {
        return "Direct iframe ready";
    }
    if (health.stream.state === "ready" && health.cdp.state === "pending") {
        return "Stream ready, CDP still starting";
    }
    if (health.stream.state === "ready" && health.cdp.state === "failed") {
        return "Stream ready, CDP unavailable";
    }
    if (health.stream.state === "failed" && health.cdp.state === "ready") {
        return "CDP ready, stream unavailable";
    }
    if (health.status === "profile-locked") {
        return health.message || "Profile locked";
    }
    if (health.status === "error") {
        return health.message || "Browser lane error";
    }
    if (health.status === "stopped") {
        return "Lane stopped";
    }
    if (health.status === "starting" || health.status === "installing") {
        return health.message || "Lane starting";
    }
    return health.message || "Lane status unknown";
}
export function createEmptyBrowserLaneHealth(status = "stopped", message) {
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
    };
}
function inferLegacySurfaceKind(record) {
    return getBrowserLaneSurfaceKind(record);
}
function inferLegacyRuntimeOwnership(record) {
    if (record.mode === "local" || record.runtime === "docker-chromium") {
        return "managed-local";
    }
    return "attached";
}
function inferLegacyDeploymentLocation(record) {
    const host = record.host?.trim();
    if (!host) {
        return record.mode === "local" ? "local" : "unknown";
    }
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") {
        return "local";
    }
    return "remote";
}
export function migrateBrowserLaneRecord(record) {
    if ("runtimeOwnership" in record && "deploymentLocation" in record && "targetUrl" in record) {
        assertValidBrowserLaneRecord(record);
        return record;
    }
    const surfaceKind = inferLegacySurfaceKind(record);
    const runtimeOwnership = inferLegacyRuntimeOwnership(record);
    const targetUrl = surfaceKind === "direct-iframe" ? record.streamBackendUrl : null;
    const migrated = {
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
    };
    assertValidBrowserLaneRecord(migrated);
    return migrated;
}
export function inflateBrowserLane(record, health) {
    assertValidBrowserLaneRecord(record);
    return {
        ...record,
        streamPath: getBrowserLaneStreamPath(record.id),
        health: health ?? createEmptyBrowserLaneHealth(),
    };
}
