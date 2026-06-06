import { z } from "zod"

export const sidePanelTabValues = [
	"review",
	"browser",
	"notes",
	"pulse",
	"memory",
	"files",
	"terminal",
	"editor",
	"plugins",
	"bridges",
	"crm",
	"studio",
	"voice",
	"oracle",
	"claude",
	"ch5pm",
	"artifacts",
	"pdf-review",
] as const

export const sidePanelTabSchema = z.enum(sidePanelTabValues)

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
	"palot_browser_status",
	"palot_browser_open",
	"palot_browser_navigate",
	"palot_browser_tabs",
	"palot_browser_click",
	"palot_browser_type",
	"palot_browser_scroll",
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

const browserUrlSchema = z.object({
	url: z.string().trim().min(1),
})

export const palotBrowserStatusArgsSchema = z.object({}).passthrough()
export const palotBrowserOpenArgsSchema = browserUrlSchema
export const palotBrowserNavigateArgsSchema = browserUrlSchema
export const palotBrowserTabsArgsSchema = z
	.object({
		action: z.enum(["list", "open", "close", "activate"]).optional(),
		tabId: z.string().optional(),
		url: z.string().optional(),
	})
	.passthrough()
export const palotBrowserClickArgsSchema = z
	.object({
		selector: z.string().optional(),
		text: z.string().optional(),
		role: z.string().optional(),
		x: z.number().optional(),
		y: z.number().optional(),
		button: z.enum(["left", "middle", "right"]).optional(),
		clickCount: z.number().int().positive().optional(),
	})
	.passthrough()
export const palotBrowserTypeArgsSchema = z
	.object({
		selector: z.string().optional(),
		text: z.string(),
		submit: z.boolean().optional(),
	})
	.passthrough()
export const palotBrowserScrollArgsSchema = z
	.object({
		selector: z.string().optional(),
		deltaX: z.number().optional(),
		deltaY: z.number().optional(),
		direction: z.enum(["up", "down"]).optional(),
		amount: z.number().optional(),
	})
	.passthrough()
export const palotOpenSidePanelArgsSchema = z.object({
	tab: sidePanelTabSchema,
})
export const palotUiStateArgsSchema = z.object({}).passthrough()

export const palotToolArgsSchemas = {
	palot_browser_status: palotBrowserStatusArgsSchema,
	palot_browser_open: palotBrowserOpenArgsSchema,
	palot_browser_navigate: palotBrowserNavigateArgsSchema,
	palot_browser_tabs: palotBrowserTabsArgsSchema,
	palot_browser_click: palotBrowserClickArgsSchema,
	palot_browser_type: palotBrowserTypeArgsSchema,
	palot_browser_scroll: palotBrowserScrollArgsSchema,
	palot_open_side_panel: palotOpenSidePanelArgsSchema,
	palot_ui_state: palotUiStateArgsSchema,
} as const

export type DispatchBrowserToolInput = z.infer<typeof dispatchBrowserToolInputSchema>
export type PalotResolverResult = z.infer<typeof palotResolverResultSchema>
export type PublishBrowserActionInput = z.infer<typeof publishBrowserActionInputSchema>
export type SessionBindingStoreFile = z.infer<typeof sessionBindingStoreFileSchema>
