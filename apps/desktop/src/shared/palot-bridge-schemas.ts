import { z } from "zod"
// Import from the renderer-free ids module, NOT the renderer registry:
// this file is loaded by the headless palot-bridge OpenCode plugin, where
// renderer imports (React/monaco) fail at module load time.
import { DOCUMENT_SURFACE_IDS, FIREFLY_SURFACE_IDS } from "./firefly-surface-ids"

export const sidePanelTabValues = FIREFLY_SURFACE_IDS

export const sidePanelTabSchema = z.enum(sidePanelTabValues)
export const documentPanelTabValues = DOCUMENT_SURFACE_IDS

export const documentPanelTabSchema = z.enum(documentPanelTabValues)

export const browserActionErrorCodeSchema = z.enum([
	"unbound_session",
	"lane_unavailable",
	"human_in_control",
	"magic_browser_unavailable",
	"geometry_low_confidence",
	"binding_in_flight",
	"permission_denied",
])

export const browserActionStatusSchema = z.enum([
	"queued",
	"dispatched",
	"runtime_ack",
	"completed",
	"failed",
	"cancelled",
])

export const browserActionSourceSchema = z.enum([
	"tool_request",
	"automation_runtime",
	"human_takeover",
	"system_reconcile",
])

export const sessionBindingStatusSchema = z.enum([
	"unbound",
	"attaching",
	"attached",
	"suspended",
	"restored",
	"released",
])

export const browserLaneHealthStatusSchema = z.enum([
	"installing",
	"starting",
	"running",
	"degraded",
	"stopped",
	"error",
	"profile-locked",
])

export const browserLaneReadinessSchema = z.enum(["unknown", "pending", "ready", "failed"])

export const browserLaneEndpointSchema = z.object({
	url: z.string().nullable(),
	checkedAt: z.number().nullable(),
	state: browserLaneReadinessSchema,
	error: z.string().nullable(),
})

export const browserLaneHealthSchema = z.object({
	status: browserLaneHealthStatusSchema,
	stream: browserLaneEndpointSchema,
	cdp: browserLaneEndpointSchema,
	message: z.string(),
})

export const sessionBindingSchema = z.object({
	id: z.string(),
	openCodeSessionId: z.string(),
	browserLaneId: z.string().nullable(),
	magicBrowserSessionId: z.string().nullable(),
	status: sessionBindingStatusSchema,
	createdAt: z.number(),
	updatedAt: z.number(),
	releasedAt: z.number().nullable(),
})

export const sessionBindingRecordSchema = sessionBindingSchema

export const sessionBindingStoreFileSchema = z.object({
	version: z.literal(1),
	bindings: z.array(sessionBindingRecordSchema),
})

export const browserViewportSnapshotSchema = z.object({
	currentUrl: z.string().nullable(),
	streamUrl: z.string().nullable(),
	viewportWidth: z.number().nullable(),
	viewportHeight: z.number().nullable(),
})

export const browserActionTargetDescriptionSchema = z.object({
	selector: z.string().nullable(),
	text: z.string().nullable(),
	role: z.string().nullable(),
})

export const browserActionViewportCoordsSchema = z.object({
	x: z.number(),
	y: z.number(),
})

export const streamGeometrySnapshotSchema = z.object({
	viewportWidth: z.number(),
	viewportHeight: z.number(),
	scrollX: z.number(),
	scrollY: z.number(),
	panelWidth: z.number().nullable(),
	panelHeight: z.number().nullable(),
	zoom: z.number(),
})

const browserActionBaseSchema = z.object({
	id: z.string(),
	sessionId: z.string(),
	laneId: z.string().nullable(),
	source: browserActionSourceSchema,
	sequence: z.number(),
	requestId: z.string().nullable(),
	causationId: z.string().nullable(),
	toolCallId: z.string().nullable().optional(),
	targetDescription: browserActionTargetDescriptionSchema.nullable(),
	viewportCoords: browserActionViewportCoordsSchema.nullable(),
	streamGeometrySnapshot: streamGeometrySnapshotSchema.nullable(),
	timestamp: z.number(),
	durationMs: z.number().nullable(),
	status: browserActionStatusSchema,
	errorCode: browserActionErrorCodeSchema.nullable().optional(),
	errorMessage: z.string().nullable().optional(),
})

export const browserActionEventSchema = z.discriminatedUnion("kind", [
	browserActionBaseSchema.extend({ kind: z.literal("move") }),
	browserActionBaseSchema.extend({
		kind: z.literal("click"),
		button: z.enum(["left", "middle", "right"]),
		clickCount: z.number(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("type"),
		text: z.string(),
		caretConfidence: z.enum(["none", "low", "high"]),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("scroll"),
		deltaX: z.number(),
		deltaY: z.number(),
	}),
	browserActionBaseSchema.extend({ kind: z.literal("focus") }),
	browserActionBaseSchema.extend({ kind: z.literal("hover") }),
	browserActionBaseSchema.extend({
		kind: z.literal("waitFor"),
		waitFor: z.string(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("navigate"),
		url: z.string(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("attachSession"),
		magicBrowserSessionId: z.string().nullable(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("detachSession"),
		reason: z.string().nullable(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("toolRequest"),
		toolName: z.string(),
		argsSummary: z.string().nullable(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("toolResult"),
		toolName: z.string(),
		resultSummary: z.string().nullable(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("systemReconcile"),
		reason: z.string(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("humanTakeoverPaused"),
		reason: z.string().nullable(),
	}),
	browserActionBaseSchema.extend({
		kind: z.literal("humanTakeoverResumed"),
		reason: z.string().nullable(),
	}),
])

export const palotSidePanelSnapshotSchema = z.object({
	open: z.boolean(),
	activeTab: sidePanelTabSchema.nullable(),
	availableTabs: z.array(sidePanelTabSchema),
})

export const palotUiStateSnapshotSchema = z.object({
	sidePanel: palotSidePanelSnapshotSchema,
	documentPanel: z.object({
		open: z.boolean(),
		activeTab: documentPanelTabSchema.nullable(),
		availableTabs: z.array(documentPanelTabSchema),
	}),
})

export const browserStateSnapshotSchema = z.object({
	sessionId: z.string(),
	activeLaneId: z.string().nullable(),
	magicBrowserSessionId: z.string().nullable(),
	viewerUrl: z.string().nullable(),
	binding: sessionBindingSchema.nullable(),
	health: browserLaneHealthSchema.nullable(),
	lastActions: z.array(browserActionEventSchema),
	viewport: browserViewportSnapshotSchema.nullable(),
})

export const palotNonSecretSnapshotSchema = browserStateSnapshotSchema.pick({
	sessionId: true,
	activeLaneId: true,
	magicBrowserSessionId: true,
	viewerUrl: true,
	binding: true,
	health: true,
	lastActions: true,
	viewport: true,
})

export const palotResolverResultSchema = z.object({
	binding: sessionBindingSchema.nullable(),
	nonSecretSnapshot: palotNonSecretSnapshotSchema.nullable(),
	opaqueActionTarget: z
		.object({
			bindingId: z.string(),
			laneId: z.string().nullable(),
			magicBrowserSessionId: z.string().nullable(),
		})
		.nullable(),
	uiState: palotUiStateSnapshotSchema.optional(),
})

export const dispatchBrowserToolNameSchema = z.enum([
	"browser_status",
	"browser_open",
	"browser_navigate",
	"browser_tabs",
	"browser_click",
	"browser_type",
	"browser_scroll",
	"browser_read",
	"browser_set_mode",
])

export const dispatchBrowserToolInputSchema = z.object({
	sessionId: z.string(),
	toolName: dispatchBrowserToolNameSchema,
	args: z.record(z.string(), z.unknown()),
})

export const publishBrowserActionInputSchema = z.object({
	event: browserActionEventSchema,
})

export const palotOpenSidePanelInputSchema = sidePanelTabSchema

// Raw shapes (z.ZodRawShape = Record<string, ZodType>) are the contract the
// OpenCode plugin runtime expects for a tool's `args`. OpenCode does
// `z.object(def.args)` then `z.toJSONSchema(...)` during tool registration, so
// `args` MUST be the inner field map, never a constructed ZodObject. Passing a
// whole ZodObject makes z.object() enumerate the ZodObject's internal props and
// crashes toJSONSchema with `schema._zod.def is undefined`. The `*Schema`
// exports below remain ZodObjects for runtime `.parse()` validation only.
export const palotBrowserStatusArgsShape = {} satisfies z.ZodRawShape
export const palotBrowserOpenArgsShape = {
	url: z.string().trim().min(1),
} satisfies z.ZodRawShape
export const palotBrowserNavigateArgsShape = {
	url: z.string().trim().min(1),
} satisfies z.ZodRawShape
export const palotBrowserTabsArgsShape = {
	action: z.enum(["list", "open", "close", "activate"]).optional(),
	tabId: z.string().optional(),
	url: z.string().optional(),
} satisfies z.ZodRawShape
export const palotBrowserClickArgsShape = {
	selector: z.string().optional(),
	text: z.string().optional(),
	role: z.string().optional(),
	x: z.number().optional(),
	y: z.number().optional(),
	button: z.enum(["left", "middle", "right"]).optional(),
	clickCount: z.number().int().positive().optional(),
} satisfies z.ZodRawShape
export const palotBrowserTypeArgsShape = {
	selector: z.string().optional(),
	text: z.string(),
	submit: z.boolean().optional(),
} satisfies z.ZodRawShape
export const palotBrowserScrollArgsShape = {
	selector: z.string().optional(),
	deltaX: z.number().optional(),
	deltaY: z.number().optional(),
	direction: z.enum(["up", "down"]).optional(),
	amount: z.number().optional(),
} satisfies z.ZodRawShape
export const palotComponentsListArgsShape = {
	category: z.string().optional(),
	presentation: z.enum(["inline-artifact", "chat-widget", "side-panel", "main-pane", "webview"]).optional(),
	scope: z.enum(["generic", "ch5-internal", "lab"]).optional(),
	maturity: z.enum(["stable", "beta", "alpha", "internal"]).optional(),
} satisfies z.ZodRawShape
export const palotComponentsDescribeArgsShape = {
	name: z.string().trim().min(1),
	full: z.boolean().optional(),
} satisfies z.ZodRawShape
export const loomSessionOpenArgsShape = {
	title: z.string().trim().min(1),
} satisfies z.ZodRawShape
export const loomSessionEndArgsShape = {} satisfies z.ZodRawShape
export const loomRenderArgsShape = {
	tree: z.string().trim().min(1),
} satisfies z.ZodRawShape
export const durableArtifactRecordSchema = z.object({
	id: z.string(),
	scope: z.literal("session"),
	title: z.string(),
	component: z.string(),
	props: z.record(z.string(), z.unknown()),
	source: z.object({
		sessionId: z.string(),
		messageId: z.string(),
		partId: z.string().optional(),
		component: z.string(),
		rawFence: z.string(),
	}),
	createdAt: z.number(),
	updatedAt: z.number(),
	lastRenderedAt: z.number(),
	pin: z.object({
		pinned: z.boolean(),
		placement: z.enum(["inline", "above-chat", "chat-inline-right", "side-panel"]).nullable(),
		pinnedAt: z.number().nullable(),
	}),
	version: z.number().int().positive(),
	dirty: z.array(z.string()),
	lastAgentPatchAt: z.number(),
	lastHumanEditAt: z.number(),
	schemaVersion: z.literal(1),
})

export const loomPatchArgsShape = {
	patch: z.string().trim().min(1),
} satisfies z.ZodRawShape
export const loomPollArgsShape = {
	rev: z.number().int().nonnegative().optional(),
	help: z.boolean().optional(),
} satisfies z.ZodRawShape
export const loomStateArgsShape = {
	delta: z.string().trim().min(1),
} satisfies z.ZodRawShape
export const palotOpenSidePanelArgsShape = {
	tab: sidePanelTabSchema,
} satisfies z.ZodRawShape
export const palotUiStateArgsShape = {} satisfies z.ZodRawShape

export const palotBrowserStatusArgsSchema = z.object(palotBrowserStatusArgsShape).passthrough()
export const palotBrowserOpenArgsSchema = z.object(palotBrowserOpenArgsShape)
export const palotBrowserNavigateArgsSchema = z.object(palotBrowserNavigateArgsShape)
export const palotBrowserTabsArgsSchema = z.object(palotBrowserTabsArgsShape).passthrough()
export const palotBrowserClickArgsSchema = z.object(palotBrowserClickArgsShape).passthrough()
export const palotBrowserTypeArgsSchema = z.object(palotBrowserTypeArgsShape).passthrough()
export const palotBrowserScrollArgsSchema = z.object(palotBrowserScrollArgsShape).passthrough()
export const palotComponentsListArgsSchema = z.object(palotComponentsListArgsShape).passthrough()
export const palotComponentsDescribeArgsSchema = z.object(palotComponentsDescribeArgsShape)
export const loomSessionOpenArgsSchema = z.object(loomSessionOpenArgsShape)
export const loomSessionEndArgsSchema = z.object(loomSessionEndArgsShape).passthrough()
export const loomRenderArgsSchema = z.object(loomRenderArgsShape)
export const loomPatchArgsSchema = z.object(loomPatchArgsShape)
export const loomPollArgsSchema = z.object(loomPollArgsShape).passthrough()
export const loomStateArgsSchema = z.object(loomStateArgsShape)
export const palotOpenSidePanelArgsSchema = z.object(palotOpenSidePanelArgsShape)
export const palotUiStateArgsSchema = z.object(palotUiStateArgsShape).passthrough()

export const palotComponentsListResultSchema = z.object({
	count: z.number().int().nonnegative(),
	components: z.array(
		z.object({
			name: z.string(),
			one_line: z.string(),
			category: z.string(),
			presentation: z.enum(["inline-artifact", "chat-widget", "side-panel", "main-pane", "webview"]),
			scope: z.enum(["generic", "ch5-internal", "lab"]),
			maturity: z.enum(["stable", "beta", "alpha", "internal"]),
			defaultPlacement: z.enum(["inline", "above-chat", "chat-inline-right", "side-panel", "main-pane"]),
			sourcePackage: z.string().nullable().optional(),
			storybookPath: z.string().nullable().optional(),
			docsPath: z.string().nullable().optional(),
		}),
	),
})
export const palotComponentsDescribeResultSchema = z.object({
	name: z.string().optional(),
	one_line: z.string().optional(),
	category: z.string().optional(),
	presentation: z.enum(["inline-artifact", "chat-widget", "side-panel", "main-pane", "webview"]).optional(),
	scope: z.enum(["generic", "ch5-internal", "lab"]).optional(),
	maturity: z.enum(["stable", "beta", "alpha", "internal"]).optional(),
	defaultPlacement: z.enum(["inline", "above-chat", "chat-inline-right", "side-panel", "main-pane"]).optional(),
	allowedPlacements: z.array(z.enum(["inline", "above-chat", "chat-inline-right", "side-panel", "main-pane"])).optional(),
	sourcePackage: z.string().nullable().optional(),
	storybookPath: z.string().nullable().optional(),
	docsPath: z.string().nullable().optional(),
	props_schema: z.unknown().optional(),
	example: z.unknown().optional(),
	errorCode: z.string().optional(),
	help: z.array(z.string()).optional(),
})
export const loomSessionOpenResultSchema = z.object({
	session_id: z.string(),
	surface_url: z.string(),
	rev: z.number().int().nonnegative(),
})
export const loomSessionEndResultSchema = z.object({
	rev: z.number().int().nonnegative(),
})
export const loomMutationResultSchema = z.object({
	rev: z.number().int().nonnegative(),
	errorCode: z.string().optional(),
	delta: z.array(z.unknown()).optional(),
})
export const loomPollResultSchema = z.object({
	rev: z.number().int().nonnegative(),
	events: z.array(z.unknown()),
	state_delta: z.array(z.unknown()),
	tree_slice: z.unknown().nullable(),
	help: z.array(z.string()).optional(),
	count: z.number().int().nonnegative().optional(),
})

export const palotToolArgsSchemas = {
	browser_status: palotBrowserStatusArgsSchema,
	browser_open: palotBrowserOpenArgsSchema,
	browser_navigate: palotBrowserNavigateArgsSchema,
	browser_tabs: palotBrowserTabsArgsSchema,
	browser_click: palotBrowserClickArgsSchema,
	browser_type: palotBrowserTypeArgsSchema,
	browser_scroll: palotBrowserScrollArgsSchema,
	palot_components_list: palotComponentsListArgsSchema,
	palot_components_describe: palotComponentsDescribeArgsSchema,
	palot_session_open: loomSessionOpenArgsSchema,
	palot_session_end: loomSessionEndArgsSchema,
	palot_render: loomRenderArgsSchema,
	palot_patch: loomPatchArgsSchema,
	palot_poll: loomPollArgsSchema,
	palot_state: loomStateArgsSchema,
	open_side_panel: palotOpenSidePanelArgsSchema,
	ui_state: palotUiStateArgsSchema,
} as const

export const palotToolArgsShapes = {
	browser_status: palotBrowserStatusArgsShape,
	browser_open: palotBrowserOpenArgsShape,
	browser_navigate: palotBrowserNavigateArgsShape,
	browser_tabs: palotBrowserTabsArgsShape,
	browser_click: palotBrowserClickArgsShape,
	browser_type: palotBrowserTypeArgsShape,
	browser_scroll: palotBrowserScrollArgsShape,
	palot_components_list: palotComponentsListArgsShape,
	palot_components_describe: palotComponentsDescribeArgsShape,
	palot_session_open: loomSessionOpenArgsShape,
	palot_session_end: loomSessionEndArgsShape,
	palot_render: loomRenderArgsShape,
	palot_patch: loomPatchArgsShape,
	palot_poll: loomPollArgsShape,
	palot_state: loomStateArgsShape,
	open_side_panel: palotOpenSidePanelArgsShape,
	ui_state: palotUiStateArgsShape,
} as const

export type DispatchBrowserToolInput = z.infer<typeof dispatchBrowserToolInputSchema>
export type PalotResolverResult = z.infer<typeof palotResolverResultSchema>
export type PublishBrowserActionInput = z.infer<typeof publishBrowserActionInputSchema>
export type SessionBindingStoreFile = z.infer<typeof sessionBindingStoreFileSchema>
export type LoomSessionOpenResult = z.infer<typeof loomSessionOpenResultSchema>
export type LoomPollResult = z.infer<typeof loomPollResultSchema>
