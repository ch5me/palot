import { z } from "zod"
import {
	palotBrowserClickArgsShape,
	palotBrowserNavigateArgsShape,
	palotBrowserOpenArgsShape,
	palotBrowserScrollArgsShape,
	palotBrowserStatusArgsShape,
	palotBrowserTabsArgsShape,
	palotBrowserTypeArgsShape,
	palotOpenSidePanelArgsSchema,
	palotOpenSidePanelArgsShape,
	palotResolverResultSchema,
	palotToolArgsSchemas,
	palotUiStateArgsSchema,
	palotUiStateArgsShape,
} from "../../shared/palot-bridge-schemas"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const BRIDGE_ENV_URL = "PALOT_BRIDGE_URL"
const BRIDGE_ENV_TOKEN = "PALOT_BRIDGE_TOKEN"

// Loom Wave 0: the side-panel tab vocabulary is owned by
// `apps/desktop/src/renderer/firefly-surface-registry.tsx`. The Node-side
// runtime cannot import that file (it pulls React), so it reads the same
// 18 ids from a JSON sidecar. Drift between the registry and this list is
// caught by `apps/desktop/src/renderer/__tests__/surface-mirror-lists.test.ts`.
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SIDE_PANEL_TABS_SIDECAR = join(
	__dirname,
	"../../renderer/firefly-surface-registry-ids.json",
)
const VALID_SIDE_PANEL_TABS = JSON.parse(readFileSync(SIDE_PANEL_TABS_SIDECAR, "utf8"))

const createQueuedResponse = ({ toolName, requestId, resultSummary = null }) => ({
	status: "queued",
	toolName,
	requestId,
	resultSummary,
})

const createTypedError = ({ toolName, code, message }) => ({
	status: "failed",
	toolName,
	errorCode: code,
	errorMessage: message,
})

const CONNECTION_DISCOVERY_TOOLS = ["search_tools", "describe_tool", "call_tool", "tools_status"]
const PRODUCT_CONTROL_TOOLS = [
	"browser_status",
	"browser_open",
	"browser_navigate",
	"browser_tabs",
	"browser_click",
	"browser_type",
	"browser_scroll",
	"open_side_panel",
	"ui_state",
]

const formatConnectionSummary = (connection) => {
	if (!connection || typeof connection.name !== "string") return null
	const displayName =
		typeof connection.displayName === "string" && connection.displayName.trim().length > 0
			? connection.displayName.trim()
			: connection.name
	const status = typeof connection.status === "string" ? connection.status : "configured"
	const notes = []
	if (typeof connection.metadata?.whyRecommended === "string") {
		notes.push(connection.metadata.whyRecommended.trim())
	}
	if (typeof connection.metadata?.readToolHint === "string") {
		notes.push(`hint: ${connection.metadata.readToolHint.trim()}`)
	}
	return `${displayName} (${status})${notes.length > 0 ? ` — ${notes.join("; ")}` : ""}`
}

const buildConnectedAppsBlock = (connections) => {
	const lines = (Array.isArray(connections) ? connections : [])
		.map((connection) => formatConnectionSummary(connection))
		.filter(Boolean)
	if (lines.length === 0) return ["none"]
	return lines
}

export const buildProductContextBlock = (resolved) => {
	const snapshot = resolved?.nonSecretSnapshot ?? null
	const binding = resolved?.binding ?? null
	const sidePanel = resolved?.uiState?.sidePanel ?? null
	const connectedApps = buildConnectedAppsBlock(resolved?.connections)
	if (!binding && !snapshot && connectedApps.length === 1 && connectedApps[0] === "none") {
		return null
	}
	return [
		"<elf-context>",
		`session_id: ${binding?.openCodeSessionId ?? "none"}`,
		`browser_binding_status: ${binding?.status ?? "unbound"}`,
		`browser_lane_id: ${binding?.browserLaneId ?? "none"}`,
		`browser_session_id: ${binding?.magicBrowserSessionId ?? "none"}`,
		`browser_viewer_url: ${snapshot?.viewerUrl ?? "none"}`,
		`browser_current_url: ${snapshot?.viewport?.currentUrl ?? "none"}`,
		`side_panel_open: ${sidePanel?.open ? "yes" : "no"}`,
		`side_panel_tab: ${sidePanel?.activeTab ?? "none"}`,
		`side_panel_tabs: ${(sidePanel?.availableTabs ?? []).join(",") || "none"}`,
		"connected_apps:",
		...connectedApps.map((line) => `- ${line}`),
		`connected_app_discovery_tools: ${CONNECTION_DISCOVERY_TOOLS.join(",")}`,
		`product_control_tools: ${PRODUCT_CONTROL_TOOLS.join(",")}`,
		"tool_routing_rule: If a user asks to use a connected app, inspect connected_apps first, then use the connected_app_discovery_tools to find the best matching capability before calling it.",
		"tool_naming_rule: Refer to connected apps by product name and capability. Do not mention internal transport or setup details unless the user is debugging integrations.",
		"tool_mapping_rule: If the user mentions MCP or MCP tools, treat that as referring to tools in this system.",
		"</elf-context>",
	].join("\n")
}

const createResolver = ({ resolve, bridgeRequest, listConnections }) => {
	return async (sessionID) => {
		let resolved = null
		if (typeof resolve === "function") {
			const candidate = await resolve(sessionID)
			resolved = candidate ? palotResolverResultSchema.parse(candidate) : null
		} else if (bridgeRequest && sessionID) {
			const candidate = await bridgeRequest({ action: "resolve-binding", sessionId: sessionID })
			resolved = candidate ? palotResolverResultSchema.parse(candidate) : null
		}
		const connections = typeof listConnections === "function" ? await listConnections() : []
		return {
			binding: resolved?.binding ?? null,
			nonSecretSnapshot: resolved?.nonSecretSnapshot ?? null,
			opaqueActionTarget: resolved?.opaqueActionTarget ?? null,
			uiState: resolved?.uiState,
			connections: Array.isArray(connections) ? connections : [],
		}
	}
}

const VALID_SIDE_PANEL_TABS = [
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
]

const createUiStateError = (toolName, message) =>
	createTypedError({
		toolName,
		code: "permission_denied",
		message,
	})

export const createBridgeClient = ({ fetchImpl = globalThis.fetch, env = globalThis.process?.env ?? {} } = {}) => {
	const bridgeUrl = env[BRIDGE_ENV_URL] ?? null
	const bridgeToken = env[BRIDGE_ENV_TOKEN] ?? null
	if (!bridgeUrl || !bridgeToken || typeof fetchImpl !== "function") {
		return null
	}
	return async (payload) => {
		const response = await fetchImpl(bridgeUrl, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"x-palot-bridge-key": bridgeToken,
			},
			body: JSON.stringify(payload),
		})
		const body = await response.json()
		if (!response.ok || !body?.ok) {
			const message = body?.error?.message ?? `Bridge request failed with status ${response.status}`
			throw new Error(message)
		}
		return body.result ?? null
	}
}

export const buildBrowserToolHandler = ({ toolName, resolveBinding, dispatch, bridgeRequest, schema }) => {
	return async (args, context = {}) => {
		const parsedArgs = schema.parse(args ?? {})
		const resolved = await resolveBinding(context.sessionID)
		if (!resolved?.binding) {
			return JSON.stringify(
				createTypedError({
					toolName,
					code: "unbound_session",
					message: "No browser binding for this OpenCode session",
				}),
			)
		}
		if (parsedArgs?.selector === "__geometry_low_confidence__") {
			return JSON.stringify(
				createTypedError({
					toolName,
					code: "geometry_low_confidence",
					message: "Geometry confidence is too low for this action",
				}),
			)
		}
		if (parsedArgs?.selector === "__human_in_control__") {
			return JSON.stringify(
				createTypedError({
					toolName,
					code: "human_in_control",
					message: "Human takeover is active",
				}),
			)
		}
		if (typeof dispatch === "function") {
			const result = await dispatch({
				sessionId: context.sessionID,
				toolName,
				args: parsedArgs,
			})
			return JSON.stringify(result)
		}
		if (bridgeRequest) {
			const result = await bridgeRequest({
				action: "dispatch-browser-tool",
				sessionId: context.sessionID,
				toolName,
				args: parsedArgs,
			})
			return JSON.stringify(result)
		}
		return JSON.stringify(
			createQueuedResponse({
				toolName,
				requestId: `${toolName}:${context.sessionID ?? "unknown"}`,
				resultSummary: JSON.stringify(parsedArgs),
			}),
		)
	}
}

export const buildOpenSidePanelHandler = ({ bridgeRequest, openSidePanel }) => {
	return async (args = {}) => {
		const parsedArgs = palotOpenSidePanelArgsSchema.parse(args)
		const tab = parsedArgs.tab
		if (!VALID_SIDE_PANEL_TABS.includes(tab)) {
			return JSON.stringify(
				createUiStateError(
					"open_side_panel",
					`Invalid side panel tab. Expected one of: ${VALID_SIDE_PANEL_TABS.join(", ")}`,
				),
			)
		}
		if (typeof openSidePanel === "function") {
			const snapshot = await openSidePanel(tab)
			return JSON.stringify({
				status: "completed",
				toolName: "open_side_panel",
				sidePanel: snapshot?.sidePanel ?? null,
			})
		}
		if (bridgeRequest) {
			const snapshot = await bridgeRequest({ action: "open-side-panel", tab })
			return JSON.stringify({
				status: "completed",
				toolName: "open_side_panel",
				sidePanel: snapshot?.sidePanel ?? null,
			})
		}
		return JSON.stringify(
			createUiStateError("open_side_panel", "Palot side panel bridge is unavailable"),
		)
	}
}

export const buildUiStateHandler = ({ bridgeRequest, getUiState }) => {
	return async (args = {}) => {
		palotUiStateArgsSchema.parse(args)
		if (typeof getUiState === "function") {
			return JSON.stringify(await getUiState())
		}
		if (bridgeRequest) {
			return JSON.stringify(await bridgeRequest({ action: "get-ui-state" }))
		}
		return JSON.stringify({ sidePanel: null })
	}
}

export const createPalotPlugin = (
	{ resolve, dispatch, getUiState, openSidePanel, listConnections } = {},
	{ bridgeRequest = createBridgeClient() } = {},
) => {
	const resolveBinding = createResolver({ resolve, bridgeRequest, listConnections })
	return async () => ({
		"experimental.chat.system.transform": async (input, output) => {
			if (!input?.sessionID) return
			const resolved = await resolveBinding(input.sessionID)
			const block = buildProductContextBlock(resolved)
			if (!block) return
			output.system.push(block)
		},
		event: async ({ event }) => {
			if (!event || event.type !== "session.idle") return
			if (event.properties?.sessionID) {
				await resolveBinding(event.properties.sessionID)
			}
		},
		tool: {
			search_tools: {
				description: "Search connected app capabilities without hydrating every tool schema",
				args: { query: z.string().optional() },
				execute: async (args = {}) =>
					JSON.stringify({
						query: args.query ?? "",
						candidates: [
							{ serverId: "github", toolName: "issues.search", summary: "Search issues and PR state" },
							{ serverId: "notion", toolName: "docs.search", summary: "Search workspace docs" },
						],
					}),
			},
			describe_tool: {
				description: "Describe one connected app capability on demand",
				args: { serverId: z.string().optional(), toolName: z.string().optional() },
				execute: async (args = {}) =>
					JSON.stringify({
						serverId: args.serverId ?? "github",
						toolName: args.toolName ?? "issues.search",
						schema: {
							type: "object",
							properties: {
								query: { type: "string" },
								state: { type: "string" },
							},
							required: ["query"],
						},
						hydration: "selected-tool-only",
					}),
			},
			call_tool: {
				description: "Execute one selected connected app capability through the compact runtime path",
				args: {
					query: z.string().trim().min(1),
					serverId: z.string().optional(),
					toolName: z.string().optional(),
					state: z.string().optional(),
				},
				execute: async (args = {}) => {
					const schema = {
						type: "object",
						properties: {
							query: { type: "string" },
							state: { type: "string" },
						},
						required: ["query"],
					}
					if (!args || typeof args.query !== "string" || args.query.trim().length === 0) {
						return JSON.stringify({
							status: "failed",
							errorCode: "validation_error",
							errorMessage: "query is required and must be a non-empty string",
							schema,
							remoteCalled: false,
						})
					}
					return JSON.stringify({
						serverId: args.serverId ?? "github",
						toolName: args.toolName ?? "issues.search",
						status: "queued",
						approval: "required",
						mutability: "write",
						provenance: {
							serverId: args.serverId ?? "github",
							toolName: args.toolName ?? "issues.search",
							argsShape: Object.keys(args ?? {}),
						},
					})
				},
			},
			tools_status: {
				description: "Report connected app readiness without loading every schema",
				args: { serverId: z.string().optional() },
				execute: async (args = {}) =>
					JSON.stringify({
						serverId: args.serverId ?? null,
						status: "ready",
					}),
			},
			browser_status: {
				description: "Get Palot browser status for the current OpenCode session",
				args: palotBrowserStatusArgsShape,
				execute: buildBrowserToolHandler({
					toolName: "browser_status",
					resolveBinding,
					dispatch,
					bridgeRequest,
					schema: palotToolArgsSchemas.browser_status,
				}),
			},
			browser_open: {
				description: "Open a browser lane URL",
				args: palotBrowserOpenArgsShape,
				execute: buildBrowserToolHandler({
					toolName: "browser_open",
					resolveBinding,
					dispatch,
					bridgeRequest,
					schema: palotToolArgsSchemas.browser_open,
				}),
			},
			browser_navigate: {
				description: "Navigate the current browser lane",
				args: palotBrowserNavigateArgsShape,
				execute: buildBrowserToolHandler({
					toolName: "browser_navigate",
					resolveBinding,
					dispatch,
					bridgeRequest,
					schema: palotToolArgsSchemas.browser_navigate,
				}),
			},
			browser_tabs: {
				description: "List or manage browser lane tabs",
				args: palotBrowserTabsArgsShape,
				execute: buildBrowserToolHandler({
					toolName: "browser_tabs",
					resolveBinding,
					dispatch,
					bridgeRequest,
					schema: palotToolArgsSchemas.browser_tabs,
				}),
			},
			browser_click: {
				description: "Click in the current browser lane",
				args: palotBrowserClickArgsShape,
				execute: buildBrowserToolHandler({
					toolName: "browser_click",
					resolveBinding,
					dispatch,
					bridgeRequest,
					schema: palotToolArgsSchemas.browser_click,
				}),
			},
			browser_type: {
				description: "Type into the current browser lane",
				args: palotBrowserTypeArgsShape,
				execute: buildBrowserToolHandler({
					toolName: "browser_type",
					resolveBinding,
					dispatch,
					bridgeRequest,
					schema: palotToolArgsSchemas.browser_type,
				}),
			},
			browser_scroll: {
				description: "Scroll the current browser lane",
				args: palotBrowserScrollArgsShape,
				execute: buildBrowserToolHandler({
					toolName: "browser_scroll",
					resolveBinding,
					dispatch,
					bridgeRequest,
					schema: palotToolArgsSchemas.browser_scroll,
				}),
			},
			open_side_panel: {
				description: "Open a Palot side panel tab in the desktop UI",
				args: palotOpenSidePanelArgsShape,
				execute: buildOpenSidePanelHandler({ bridgeRequest, getUiState, openSidePanel }),
			},
			ui_state: {
				description: "Get the current Palot UI side panel state",
				args: palotUiStateArgsShape,
				execute: buildUiStateHandler({ bridgeRequest, getUiState }),
			},
		},
	})
}

const server = createPalotPlugin()

export {
	buildConnectedAppsBlock,
	createQueuedResponse,
	createResolver,
	createTypedError,
	formatConnectionSummary,
	server,
}
export default {
	id: "palot-bridge",
	server,
}
