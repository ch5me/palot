import type { ReactNode } from "react"
import { CheckSquare2Icon, ServerIcon } from "lucide-react"
import { SessionTaskList } from "./components/chat/session-task-list"
// Artifacts widget temporarily disabled — see the commented-out registry entry below.
// import { BoxesIcon } from "lucide-react"
// import { GenUiArtifactWidget } from "./components/genui/genui-artifact-widget"
import { DevmuxToolbarWidget } from "./components/devmux/devmux-toolbar-widget"
import type { SessionWidgetId, SessionWidgetZoneId } from "./atoms/session-widgets"
import type { Agent } from "./lib/types"

export interface SessionWidgetRenderContext {
	agent: Agent
}

export interface SessionWidgetDefinition {
	id: SessionWidgetId
	title: string
	defaultZoneId: SessionWidgetZoneId
	icon: typeof CheckSquare2Icon
	render: (ctx: SessionWidgetRenderContext) => ReactNode
}

// Partial: not every SessionWidgetId is required to have a live definition. The
// `genui-artifacts` id is still part of the union (and the firefly-plugin
// migration) so persisted layouts stay valid, but its widget is currently
// disabled below. Lookups guard for `undefined` (see SessionWidgetCard).
export const SESSION_WIDGET_REGISTRY: Partial<Record<SessionWidgetId, SessionWidgetDefinition>> = {
	"devmux-toolbar": {
		id: "devmux-toolbar",
		title: "DevMux",
		defaultZoneId: "above-chat",
		icon: ServerIcon,
		render: ({ agent }) => <DevmuxToolbarWidget agent={agent} />,
	},
	"session-task-list": {
		id: "session-task-list",
		title: "Task list",
		defaultZoneId: "above-chat",
		icon: CheckSquare2Icon,
		render: ({ agent }) => <SessionTaskList sessionId={agent.sessionId} />,
	},
	// Artifacts widget temporarily removed from the session widget drawer while we
	// find a better home for it. To restore: uncomment this block, the BoxesIcon +
	// GenUiArtifactWidget imports above, and re-add "genui-artifacts" to
	// DEFAULT_LAYOUT["chat-inline-right"] in atoms/session-widgets.ts.
	// "genui-artifacts": {
	// 	id: "genui-artifacts",
	// 	title: "Artifacts",
	// 	defaultZoneId: "chat-inline-right",
	// 	icon: BoxesIcon,
	// 	render: ({ agent }) => <GenUiArtifactWidget agent={agent} placement="chat-inline-right" />,
	// },
}
