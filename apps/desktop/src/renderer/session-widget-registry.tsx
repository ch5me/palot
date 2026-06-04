import type { ReactNode } from "react"
import { CheckSquare2Icon } from "lucide-react"
import { SessionTaskList } from "./components/chat/session-task-list"
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
	"session-task-list": {
		id: "session-task-list",
		title: "Task list",
		defaultZoneId: "above-chat",
		icon: CheckSquare2Icon,
		render: ({ agent }) => <SessionTaskList sessionId={agent.sessionId} />,
	},
}
