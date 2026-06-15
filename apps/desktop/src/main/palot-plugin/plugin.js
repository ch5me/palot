import { z } from "zod"
import {
	loomMutationResultSchema,
	loomPollResultSchema,
	loomRenderArgsShape,
	loomSessionEndResultSchema,
	loomSessionOpenArgsShape,
	loomSessionOpenResultSchema,
	loomPatchArgsShape,
	loomPollArgsShape,
	loomStateArgsShape,
	palotToolArgsShapes,
	palotBrowserClickArgsShape,
	palotBrowserNavigateArgsShape,
	palotBrowserOpenArgsShape,
	palotBrowserScrollArgsShape,
	palotBrowserStatusArgsShape,
	palotBrowserTabsArgsShape,
	palotBrowserTypeArgsShape,
	palotComponentsDescribeArgsShape,
	palotComponentsDescribeResultSchema,
	palotComponentsListArgsShape,
	palotComponentsListResultSchema,
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
import { openLoomSession as resolveOpenLoomSession } from "../palot-resolver"
import {
	patchCommand,
	pollCommand,
	renderCommand,
	sessionEndCommand,
	sessionOpenCommand,
	stateCommand,
} from "../palot-runtime/commands"
import { describeComponentCatalogEntry, getComponentCatalogItems } from "../palot-runtime/component-catalog"
import { decode as decodeToon, encode as encodeToon } from "../palot-runtime/toon"

const BRIDGE_ENV_URL = "PALOT_BRIDGE_URL"
const BRIDGE_ENV_TOKEN = "PALOT_BRIDGE_TOKEN"

// Loom Wave 0: the side-panel tab vocabulary is owned by
// `apps/desktop/src/renderer/firefly-surface-registry.tsx`. The Node-side
// runtime cannot import that file (it pulls React), so it reads the same
// ids from a JSON sidecar. Drift is guarded elsewhere.
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
	"palot_components_list",
	"palot_components_describe",
	"palot_session_open",
	"palot_session_end",
	"palot_render",
	"palot_patch",
	"palot_poll",
	"palot_state",
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
	const documentPanel = resolved?.uiState?.documentPanel ?? null
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
		`document_panel_open: ${documentPanel?.open ? "yes" : "no"}`,
		`document_panel_tab: ${documentPanel?.activeTab ?? "none"}`,
		`document_panel_tabs: ${(documentPanel?.availableTabs ?? []).join(",") || "none"}`,
		`loom_component_tools: ${resolved?.loomComponentToolsEnabled ? "enabled" : "disabled"}`,
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
			loomComponentToolsEnabled: process.env.LOOM_COMPONENT_TOOLS_ENABLED === "1",
		}
	}
}

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
				documentPanel: snapshot?.documentPanel ?? null,
			})
		}
		if (bridgeRequest) {
			const snapshot = await bridgeRequest({ action: "open-side-panel", tab })
			return JSON.stringify({
				status: "completed",
				toolName: "open_side_panel",
				sidePanel: snapshot?.sidePanel ?? null,
				documentPanel: snapshot?.documentPanel ?? null,
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
		return JSON.stringify({
			sidePanel: { open: false, activeTab: null, availableTabs: [] },
			documentPanel: { open: false, activeTab: null, availableTabs: [] },
		})
	}
}

// ---------------------------------------------------------------------------
// V2 plugin catalog → dynamic OpenCode tool projection
//
// At plugin init we ask the host bridge for every available catalog tool
// (`plugin.<id>.*`) and register each one as a real OpenCode tool. The
// host re-validates args and re-checks enable/quarantine state on every
// invoke (`invokePluginTool`), so this projection is a view, not an
// authority. Catalog tool names never collide with the static palot
// tools (they are namespaced `plugin.<plugin-id>.<verb>`).
// ---------------------------------------------------------------------------

const jsonSchemaNodeToZod = (node) => {
	if (!node || typeof node !== "object") return z.unknown()
	if (Array.isArray(node.enum) && node.enum.length > 0) {
		const literals = node.enum.map((value) => z.literal(value))
		return literals.length === 1 ? literals[0] : z.union(literals)
	}
	switch (node.type) {
		case "string":
			return z.string()
		case "number":
			return z.number()
		case "integer":
			return z.number().int()
		case "boolean":
			return z.boolean()
		case "null":
			return z.null()
		case "array":
			return z.array(jsonSchemaNodeToZod(node.items))
		case "object": {
			const shape = jsonSchemaShapeFromObjectSchema(node)
			return z.object(shape).passthrough()
		}
		default:
			return z.unknown()
	}
}

export const jsonSchemaShapeFromObjectSchema = (objectSchema) => {
	const shape = {}
	const properties =
		objectSchema && typeof objectSchema === "object" && objectSchema.properties &&
		typeof objectSchema.properties === "object"
			? objectSchema.properties
			: {}
	const required = new Set(Array.isArray(objectSchema?.required) ? objectSchema.required : [])
	for (const [key, propertySchema] of Object.entries(properties)) {
		const zodType = jsonSchemaNodeToZod(propertySchema)
		shape[key] = required.has(key) ? zodType : zodType.optional()
	}
	return shape
}

export const buildCatalogToolEntries = async ({ bridgeRequest }) => {
	if (!bridgeRequest) return {}
	let listing
	try {
		listing = await bridgeRequest({ action: "list-plugin-tools" })
	} catch (error) {
		console.error(
			"[palot-plugin] plugin catalog tool listing failed; continuing with static tools only:",
			error instanceof Error ? error.message : error,
		)
		return {}
	}
	const tools = {}
	for (const def of Array.isArray(listing?.tools) ? listing.tools : []) {
		if (typeof def?.toolId !== "string" || typeof def?.pluginId !== "string") continue
		const toolId = def.toolId
		const description = typeof def.description === "string" ? def.description : toolId
		tools[toolId] = {
			description,
			args: jsonSchemaShapeFromObjectSchema(def.argsJsonSchema),
			execute: async (args = {}, context = {}) => {
				const envelope = await bridgeRequest({
					action: "invoke-plugin-tool",
					pluginId: def.pluginId,
					toolId,
					args: args ?? {},
					sessionId: context.sessionID ?? null,
				})
				return JSON.stringify(envelope)
			},
		}
	}
	return tools
}

export const buildComponentsListHandler = () => {
	return async (args = {}) => {
		const parsedArgs = palotToolArgsSchemas.palot_components_list.parse(args)
		const components = getComponentCatalogItems()
			.filter((entry) => !parsedArgs.category || entry.category === parsedArgs.category)
			.filter((entry) => !parsedArgs.presentation || entry.presentation === parsedArgs.presentation)
			.filter((entry) => !parsedArgs.scope || entry.scope === parsedArgs.scope)
			.filter((entry) => !parsedArgs.maturity || entry.maturity === parsedArgs.maturity)
			.map((entry) => ({
				name: entry.name,
				one_line: entry.one_line,
				category: entry.category,
				presentation: entry.presentation,
				scope: entry.scope,
				maturity: entry.maturity,
				defaultPlacement: entry.defaultPlacement,
				sourcePackage: entry.sourcePackage ?? null,
				storybookPath: entry.storybookPath ?? null,
				docsPath: entry.docsPath ?? null,
			}))
		const result = palotComponentsListResultSchema.parse({ count: components.length, components })
		return encodeToon(result)
	}
}

export const buildComponentsDescribeHandler = () => {
	return async (args = {}) => {
		const parsedArgs = palotToolArgsSchemas.palot_components_describe.parse(args)
		const entry = describeComponentCatalogEntry(parsedArgs.name)
		if (!entry) {
			return encodeToon(
				palotComponentsDescribeResultSchema.parse({
					errorCode: "unknown_component",
					help: ["Run `palot components list` to see available components."],
				}),
			)
		}
		const props_schema = parsedArgs.full
			? z.toJSONSchema(entry.propsSchema)
			: { type: "object", properties: z.toJSONSchema(entry.propsSchema).properties ?? {}, path: entry.name }
		return encodeToon(
			palotComponentsDescribeResultSchema.parse({
				name: entry.name,
				one_line: entry.one_line,
				category: entry.category,
				presentation: entry.presentation,
				scope: entry.scope,
				maturity: entry.maturity,
				defaultPlacement: entry.defaultPlacement,
				allowedPlacements: entry.allowedPlacements,
				sourcePackage: entry.sourcePackage ?? null,
				storybookPath: entry.storybookPath ?? null,
				docsPath: entry.docsPath ?? null,
				props_schema,
				example: entry.example,
			}),
		)
	}
}

function formatPollHelp() {
	return [
		"Use `rev` to request changes newer than known revision. Use append patches for chunked text or markdown updates.",
		"Returns count: 0 when no events, no state delta, and no tree slice.",
		"Long-poll cap handled by Loom bridge server at 30s max.",
	]
}

export const buildLoomSessionOpenHandler = () => {
	return async (args = {}, context = {}) => {
		const parsedArgs = palotToolArgsSchemas.palot_session_open.parse(args)
		const sessionId = context.sessionID
		if (!sessionId) {
			return encodeToon({ errorCode: "missing_session", help: ["OpenCode session context required."] })
		}
		sessionOpenCommand(sessionId, encodeToon(parsedArgs))
		const opened = await resolveOpenLoomSession(sessionId)
		return encodeToon(loomSessionOpenResultSchema.parse(opened))
	}
}

export const buildLoomSessionEndHandler = () => {
	return async (_args = {}, context = {}) => {
		if (!context.sessionID) {
			return encodeToon({ errorCode: "missing_session", help: ["OpenCode session context required."] })
		}
		return encodeToon(loomSessionEndResultSchema.parse(sessionEndCommand(context.sessionID)))
	}
}

export const buildLoomRenderHandler = () => {
	return async (args = {}, context = {}) => {
		const parsedArgs = palotToolArgsSchemas.palot_render.parse(args)
		if (!context.sessionID) {
			return encodeToon({ errorCode: "missing_session", help: ["OpenCode session context required."] })
		}
		const decodedTree = decodeToon(parsedArgs.tree)
		const tree =
			decodedTree && typeof decodedTree === "object"
				? (decodedTree.root ?? decodedTree.tree ?? decodedTree)
				: decodedTree
		return encodeToon(
			loomMutationResultSchema.parse(
				renderCommand(context.sessionID, encodeToon({ tree })),
			),
		)
	}
}

export const buildLoomPatchHandler = () => {
	return async (args = {}, context = {}) => {
		const parsedArgs = palotToolArgsSchemas.palot_patch.parse(args)
		if (!context.sessionID) {
			return encodeToon({ errorCode: "missing_session", help: ["OpenCode session context required."] })
		}
		const decodedPatch = decodeToon(parsedArgs.patch)
		const normalizedPatch = {
			rev: decodedPatch.rev,
			nodeId: decodedPatch.nodeId ?? decodedPatch.node_id,
			field: decodedPatch.field,
			value: decodedPatch.value ?? decodedPatch.chunk,
			append: decodedPatch.append ?? false,
		}
		return encodeToon(
			loomMutationResultSchema.parse(
				patchCommand(context.sessionID, encodeToon({ patch: normalizedPatch })),
			),
		)
	}
}

export const buildLoomPollHandler = () => {
	return async (args = {}, context = {}) => {
		const parsedArgs = palotToolArgsSchemas.palot_poll.parse(args)
		if (parsedArgs.help) {
			return encodeToon(loomPollResultSchema.parse({ rev: parsedArgs.rev ?? 0, events: [], state_delta: [], tree_slice: null, help: formatPollHelp(), count: 0 }))
		}
		if (!context.sessionID) {
			return encodeToon({ errorCode: "missing_session", help: ["OpenCode session context required."] })
		}
		const result = pollCommand(context.sessionID, encodeToon({ rev: parsedArgs.rev ?? 0 }))
		const count = result.events.length + result.stateDelta.length + (result.treeSlice ? 1 : 0)
		const payload = loomPollResultSchema.parse({
			rev: result.rev,
			events: result.events,
			state_delta: result.stateDelta,
			tree_slice: result.treeSlice,
			count,
		})
		return encodeToon(payload)
	}
}

export const buildLoomStateHandler = () => {
	return async (args = {}, context = {}) => {
		const parsedArgs = palotToolArgsSchemas.palot_state.parse(args)
		if (!context.sessionID) {
			return encodeToon({ errorCode: "missing_session", help: ["OpenCode session context required."] })
		}
		return encodeToon(loomMutationResultSchema.parse(stateCommand(context.sessionID, parsedArgs.delta)))
	}
}

export const createPalotPlugin = (
	{ resolve, dispatch, getUiState, openSidePanel, listConnections } = {},
	{ bridgeRequest = createBridgeClient() } = {},
) => {
	const resolveBinding = createResolver({ resolve, bridgeRequest, listConnections })
	return async () => {
		const catalogTools = await buildCatalogToolEntries({ bridgeRequest })
		return {
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
			// Catalog-projected tools first: static palot tools keep priority
			// on a (never expected) name collision.
			...catalogTools,
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
					// Fail fast: the connected-app runtime path is not wired yet.
					// Never report a fake "queued"/"approval: required" state — no
					// approval queue exists, so that response permanently dead-ends
					// any agent that routes a real tool call through this stub
					// (e.g. headless benchmark workers calling magic_browser_* names).
					return JSON.stringify({
						status: "failed",
						errorCode: "not_implemented",
						errorMessage:
							"call_tool connected-app execution is not implemented; there is no approval queue behind this tool. Call the target tool by its exact native name instead of routing through call_tool.",
						requested: {
							serverId: args.serverId ?? null,
							toolName: args.toolName ?? null,
						},
						schema,
						remoteCalled: false,
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
			palot_components_list: {
				description: "List Loom component discovery entries as TOON",
				args: palotComponentsListArgsShape,
				execute: buildComponentsListHandler(),
			},
			palot_components_describe: {
				description: "Describe one Loom component as TOON",
				args: palotComponentsDescribeArgsShape,
				execute: buildComponentsDescribeHandler(),
			},
			palot_session_open: {
				description: "Open Loom session and return surface URL as TOON",
				args: loomSessionOpenArgsShape,
				execute: buildLoomSessionOpenHandler(),
			},
			palot_session_end: {
				description: "End Loom session and return rev as TOON",
				args: palotToolArgsShapes.palot_session_end,
				execute: buildLoomSessionEndHandler(),
			},
			palot_render: {
				description: "Render Loom tree from TOON payload",
				args: loomRenderArgsShape,
				execute: buildLoomRenderHandler(),
			},
			palot_patch: {
				description: "Patch Loom tree from TOON payload",
				args: loomPatchArgsShape,
				execute: buildLoomPatchHandler(),
			},
			palot_poll: {
				description: "Poll Loom runtime for frames as TOON",
				args: loomPollArgsShape,
				execute: buildLoomPollHandler(),
			},
			palot_state: {
				description: "Queue Loom state delta from TOON payload",
				args: loomStateArgsShape,
				execute: buildLoomStateHandler(),
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
		}
	}
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
