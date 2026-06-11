// Import SDK types we reference in our own interfaces
import type {
	PermissionRequest as SdkPermissionRequest,
	QuestionRequest as SdkQuestionRequest,
} from "@opencode-ai/sdk/v2/client"
import type { SidePanelTabId } from "../atoms/ui"

// Re-export all SDK types from v2
export type {
	AssistantMessage,
	Event,
	EventMessagePartDelta,
	EventMessagePartUpdated,
	EventPermissionAsked,
	EventSessionCreated,
	EventSessionDeleted,
	EventSessionError,
	EventSessionStatus,
	EventSessionUpdated,
	FileDiff,
	FilePart,
	FilePartInput,
	Message,
	Part,
	PermissionRequest,
	Project as OpenCodeProject,
	QuestionAnswer,
	QuestionInfo,
	QuestionOption,
	QuestionRequest,
	ReasoningPart,
	Session,
	SessionStatus,
	TextPart,
	Todo,
	ToolPart,
	ToolState,
	ToolStateCompleted,
	UserMessage,
} from "@opencode-ai/sdk/v2/client"
import type { BrowserLane as PreloadBrowserLane } from "../../preload/api"

export type {
	BrowserLaneCapabilityReport,
	BrowserLaneEndpoint,
	BrowserLaneHealth,
	BrowserLaneMode,
	BrowserLaneReadiness,
	BrowserLaneRecord,
	BrowserLaneRuntime,
	BrowserLaneStatus,
	BrowserLaneTab,
	BrowserLaneTabActionResult,
	BrowserLaneTabsState,
	CreateBrowserLaneTabInput,
	NavigateBrowserLaneTabInput,
} from "../../preload/api"

export interface BrowserLane extends PreloadBrowserLane {
	desktopStreamUrl?: string | null
}

// ============================================================
// File attachment types
// ============================================================

/**
 * A file attachment ready to send — matches the shape returned by
 * PromptInput's onSubmit callback (FileUIPart from the `ai` package).
 */
export interface FileAttachment {
	type: "file"
	url: string
	mediaType?: string
	filename?: string
}

// ============================================================
// App-specific types
// ============================================================

/** An OpenCode server instance we're managing */
export interface ServerInstance {
	/** Unique ID for this server */
	id: string
	/** The project directory this server is for */
	directory: string
	/** URL of the running server */
	url: string
	/** Whether the server is healthy */
	connected: boolean
}

/** Where an agent runs */
export type EnvironmentType = "local" | "cloud" | "vm"

/** Derived agent status for UI display, mapped from SessionStatus */
export type AgentStatus = "running" | "waiting" | "degraded" | "idle"

/** Project in the sidebar — aggregates from OpenCode projects */
export interface ProjectInfo {
	id: string
	name: string
	directory: string
	agentCount: number
}

/** Enriched project for the unified sidebar (includes directory for auto-start) */
export interface SidebarProject {
	/** OpenCode project ID (root commit hash) or hash of directory as fallback */
	id: string
	/** URL-safe slug: always `{name}-{id.slice(0,12)}` for stability */
	slug: string
	name: string
	directory: string
	agentCount: number
	lastActiveAt: number
	/** Whether at least one agent in this project is running or waiting for input */
	hasActiveAgent: boolean
}

/** Activity entry for the detail panel — derived from message parts */
export interface Activity {
	id: string
	timestamp: string
	type: "read" | "search" | "edit" | "run" | "think" | "write" | "tool"
	description: string
	detail?: string
}

/**
 * Agent is our UI-facing representation of an OpenCode session.
 * It merges Session data + SessionStatus + derived activity info.
 *
 * Note: Metrics (cost, tokens, work time, exchange count) are NOT included here.
 * They are expensive to compute (require iterating all messages + parts) and are
 * only needed by the SessionMetricsBar and command palette. Those components
 * subscribe to `sessionMetricsFamily` directly.
 */
export type GenUiArtifactScope = "session"

export type GenUiArtifactPlacement = "inline" | "above-chat" | "chat-inline-right" | "side-panel"

export interface GenUiArtifactSource {
	sessionId: string
	messageId: string
	partId?: string
	component: string
	rawFence: string
}

export interface GenUiArtifactPinState {
	pinned: boolean
	placement: GenUiArtifactPlacement | null
	pinnedAt: number | null
}

export interface GenUiArtifactRecord {
	id: string
	scope: GenUiArtifactScope
	title: string
	component: string
	props: Record<string, unknown>
	source: GenUiArtifactSource
	createdAt: number
	updatedAt: number
	lastRenderedAt: number
	pin: GenUiArtifactPinState
	version: number
	dirty: string[]
	lastAgentPatchAt: number
	lastHumanEditAt: number
	schemaVersion: 1
}

export interface GenUiArtifactDescriptor {
	component: string
	title?: string
	props: Record<string, unknown>
}

export type FireflySurfaceTarget = {
	kind: "side-panel"
	tab: SidePanelTabId
}

export type AgentVisibilityReason =
	| "visible"
	| "child-session"
	| "pm-session"
	| "noise-project"
	| "excluded"

export type AgentPresenceSource = "attach" | "inferred" | "none"

export type AgentDriftFlag =
	| "invisible-running"
	| "stale-recency"
	| "attached-but-unhydrated"
	| "timed-out-parent-live-child"
	| "missing-child"

export interface Agent {
	id: string
	name: string
	status: AgentStatus
	isAttached: boolean
	presenceSource: AgentPresenceSource
	visibilityReason: AgentVisibilityReason
	driftFlags: AgentDriftFlag[]
	environment: EnvironmentType
	project: string
	projectSlug: string
	directory: string
	projectDirectory: string
	branch: string
	duration: string
	currentActivity?: string
	activities: Activity[]
	sessionId: string
	permissions: SdkPermissionRequest[]
	questions: SdkQuestionRequest[]
	parentId?: string
	worktreePath?: string
	worktreeBranch?: string
	createdAt: number
	lastActiveAt: number
	lastContentActivityAt: number
	providerID?: string
	modelID?: string
	agentType?: string
	childSessionIds: string[]
}
