import type { ReactNode } from "react"
import { BoxesIcon, CheckSquare2Icon, ServerIcon } from "lucide-react"
import { SessionTaskList } from "./components/chat/session-task-list"
import { GenUiArtifactWidget } from "./components/genui/genui-artifact-widget"
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

export const SESSION_WIDGET_REGISTRY: Record<SessionWidgetId, SessionWidgetDefinition> = {
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
	"genui-artifacts": {
		id: "genui-artifacts",
		title: "Artifacts",
		defaultZoneId: "chat-inline-right",
		icon: BoxesIcon,
		render: ({ agent }) => <GenUiArtifactWidget agent={agent} placement="chat-inline-right" />,
	},
}
