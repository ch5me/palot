export type BrowserLaneSurfaceKind = "selkies-stream" | "direct-iframe";
export type BrowserLaneRuntimeOwnership = "managed-local" | "attached";
export type BrowserLaneDeploymentLocation = "local" | "remote" | "unknown";
export type BrowserLaneStatus = "installing" | "starting" | "running" | "degraded" | "stopped" | "error" | "profile-locked";
export type BrowserLaneReadiness = "unknown" | "pending" | "ready" | "failed" | "not-applicable";
export interface BrowserLaneEndpoint {
    url: string | null;
    checkedAt: number | null;
    state: BrowserLaneReadiness;
    error: string | null;
}
export interface BrowserLaneHealth {
    status: BrowserLaneStatus;
    stream: BrowserLaneEndpoint;
    cdp: BrowserLaneEndpoint;
    message: string;
}
export interface BrowserLaneLegacySurfaceInput {
    surfaceKind?: BrowserLaneSurfaceKind;
    runtime?: "docker-chromium" | "remote-attached";
    cdpEndpoint?: string | null;
}
export interface BrowserLane {
    id: string;
    label: string;
    surfaceKind: BrowserLaneSurfaceKind;
    runtimeOwnership: BrowserLaneRuntimeOwnership;
    deploymentLocation: BrowserLaneDeploymentLocation;
    streamPath: string;
    targetUrl: string | null;
    streamBackendUrl: string | null;
    cdpEndpoint: string | null;
    profilePath: string | null;
    host: string | null;
    createdAt: number;
    updatedAt: number;
    health: BrowserLaneHealth;
}
export interface BrowserLaneRecord {
    id: string;
    label: string;
    surfaceKind: BrowserLaneSurfaceKind;
    runtimeOwnership: BrowserLaneRuntimeOwnership;
    deploymentLocation: BrowserLaneDeploymentLocation;
    targetUrl: string | null;
    streamBackendUrl: string | null;
    cdpEndpoint: string | null;
    profilePath: string | null;
    host: string | null;
    createdAt: number;
    updatedAt: number;
}
interface LegacyBrowserLaneRecord {
    id: string;
    label: string;
    mode?: "local" | "remote";
    runtime?: "docker-chromium" | "remote-attached";
    surfaceKind?: BrowserLaneSurfaceKind;
    streamBackendUrl: string | null;
    cdpEndpoint?: string | null;
    profilePath?: string | null;
    host?: string | null;
    createdAt?: number;
    updatedAt?: number;
}
export interface BrowserLanePaths {
    configDir: string;
    dataDir: string;
    lanesDir: string;
    recordFile: string;
    runtimeDir: string;
    profileRootDir: string;
    profileDir: string;
    composeFile: string;
    envFile: string;
}
export interface BrowserLaneCapabilityReport {
    platform: NodeJS.Platform;
    localRuntimeSupported: boolean;
    remoteAttachSupported: boolean;
    docker: {
        installed: boolean;
        version: string | null;
    };
    compose: {
        available: boolean;
        command: "docker compose" | "docker-compose" | null;
        version: string | null;
    };
    unsupportedReason: string | null;
    remediation: string | null;
}
export declare const DEFAULT_BROWSER_LANE_ID = "default";
export declare const BROWSER_LANE_RECORD_FILE = "lanes.json";
export declare const BROWSER_LANE_RUNTIME_DIR = "browser-lanes";
export declare const BROWSER_LANE_REGISTRY_VERSION = 2;
export declare function isValidBrowserLaneId(laneId: string): boolean;
export declare function assertValidBrowserLaneId(laneId: string): void;
export declare function getBrowserLaneStreamPath(laneId: string): string;
export declare function getBrowserLaneStoragePaths(laneId: string): BrowserLanePaths;
export declare function isManagedBrowserLane(lane: Pick<BrowserLaneRecord, "runtimeOwnership">): boolean;
export declare function isAttachedBrowserLane(lane: Pick<BrowserLaneRecord, "runtimeOwnership">): boolean;
export declare function isDirectIframeBrowserLane(lane: Pick<BrowserLaneRecord, "surfaceKind">): boolean;
export declare function isSelkiesBrowserLane(lane: Pick<BrowserLaneRecord, "surfaceKind">): boolean;
export declare function assertValidBrowserLaneRecord(record: BrowserLaneRecord): void;
export declare function getBrowserLaneSurfaceUrl(lane: Pick<BrowserLaneRecord, "surfaceKind" | "targetUrl" | "streamBackendUrl">): string | null;
export declare function getBrowserLaneSurfaceKind(input: BrowserLaneLegacySurfaceInput): BrowserLaneSurfaceKind;
export declare function summarizeBrowserLaneHealth(health: BrowserLaneHealth): string;
export declare function createEmptyBrowserLaneHealth(status?: BrowserLaneStatus, message?: string): BrowserLaneHealth;
export declare function migrateBrowserLaneRecord(record: BrowserLaneRecord | LegacyBrowserLaneRecord): BrowserLaneRecord;
export declare function inflateBrowserLane(record: BrowserLaneRecord, health?: BrowserLaneHealth): BrowserLane;
export {};
//# sourceMappingURL=browser-lanes.d.ts.map