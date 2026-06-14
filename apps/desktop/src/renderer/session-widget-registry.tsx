import type { ComponentType, ReactNode } from "react"
import { BoxesIcon, CheckSquare2Icon } from "lucide-react"
import { SessionTaskList } from "./components/chat/session-task-list"
import { GenUiArtifactWidget } from "./components/genui/genui-artifact-widget"
import type { SessionWidgetId, SessionWidgetZoneId } from "./atoms/session-widgets"
import type { Agent, GenUiArtifactPlacement } from "./lib/types"
import type { NormalizedWorkspaceDescriptor, WorkspaceHostDescriptor } from "./workspace-panel-descriptors"

export interface SessionWidgetRenderContext {
	agent: Agent
}

export type SessionWidgetHostDescriptor = WorkspaceHostDescriptor<
	SessionWidgetId,
	SessionWidgetZoneId,
	SessionWidgetRenderContext,
	{ available: true }
>

export interface SessionWidgetDefinition {
	id: SessionWidgetId
	descriptor: SessionWidgetHostDescriptor
}

export interface SessionWidgetResolvedDescriptor extends NormalizedWorkspaceDescriptor<
	SessionWidgetId,
	SessionWidgetZoneId,
	{ available: true },
	SessionWidgetHostDescriptor["runtime"],
	{ kind: "session-widget"; zoneId: SessionWidgetZoneId }
> {}

interface SessionTaskListRuntimeProps {
	sessionId: string
}

interface GenUiArtifactRuntimeProps {
	agent: Agent
	placement: Exclude<GenUiArtifactPlacement, "inline">
}

type SessionWidgetComponent = ComponentType<object>

function componentEntrypoint<Props extends object>(
	Component: ComponentType<Props>,
	resolveProps: (ctx: SessionWidgetRenderContext) => Props,
): SessionWidgetHostDescriptor["runtime"] {
	return {
		kind: "react-host-component",
		renderMode: "host-reconciler",
		resolve: (ctx) => ({
			Component: Component as SessionWidgetComponent,
			props: resolveProps(ctx),
		}),
	}
}

function widgetDescriptor(config: {
	id: SessionWidgetId
	title: string
	defaultZoneId: SessionWidgetZoneId
	icon: typeof CheckSquare2Icon
	runtime: SessionWidgetHostDescriptor["runtime"]
	hostPolicy?: SessionWidgetHostDescriptor["hostPolicy"]["hostPolicy"]
	multiplicityPolicy?: SessionWidgetHostDescriptor["hostPolicy"]["multiplicityPolicy"]
}): SessionWidgetDefinition {
	return {
		id: config.id,
		descriptor: {
			id: config.id,
			hostPolicy: {
				logicalKind: "session-widget",
				defaultZoneId: config.defaultZoneId,
				hostPolicy: config.hostPolicy ?? "remount-ok",
				multiplicityPolicy: config.multiplicityPolicy ?? "singleton",
			},
			presentation: {
				getTitle: () => config.title,
				getIcon: () => config.icon,
				getAvailability: () => ({ available: true }),
			},
			runtime: config.runtime,
		},
	}
}

export const SESSION_WIDGET_REGISTRY: Record<SessionWidgetId, SessionWidgetDefinition> = {
	"session-task-list": widgetDescriptor({
		id: "session-task-list",
		title: "Task list",
		defaultZoneId: "above-chat",
		icon: CheckSquare2Icon,
		runtime: componentEntrypoint(SessionTaskList as ComponentType<SessionTaskListRuntimeProps>, ({ agent }) => ({
			sessionId: agent.sessionId,
		})),
		hostPolicy: "stable",
	}),
	"genui-artifacts": widgetDescriptor({
		id: "genui-artifacts",
		title: "Artifacts",
		defaultZoneId: "chat-inline-right",
		icon: BoxesIcon,
		runtime: componentEntrypoint(GenUiArtifactWidget as ComponentType<GenUiArtifactRuntimeProps>, ({ agent }): GenUiArtifactRuntimeProps => ({
			agent,
			placement: "chat-inline-right",
		})),
	}),
}

export function resolveSessionWidgetDescriptor(
	widget: SessionWidgetDefinition,
	ctx: SessionWidgetRenderContext,
): SessionWidgetResolvedDescriptor {
	return {
		id: widget.id,
		title: widget.descriptor.presentation.getTitle(ctx),
		icon: widget.descriptor.presentation.getIcon(ctx),
		availability: widget.descriptor.presentation.getAvailability(ctx),
		hostPolicy: widget.descriptor.hostPolicy,
		runtime: widget.descriptor.runtime,
		target: { kind: "session-widget", zoneId: widget.descriptor.hostPolicy.defaultZoneId },
		commandIds: [],
		persistenceKey: `session-widget.${widget.id}`,
		telemetryNamespace: `session-widget.${widget.id}`,
	}
}

export function renderSessionWidgetRuntime(
	runtime: SessionWidgetHostDescriptor["runtime"],
	ctx: SessionWidgetRenderContext,
): ReactNode {
	if (runtime.kind !== "react-host-component") {
		throw new Error(`unsupported session widget runtime kind: ${runtime.kind}`)
	}
	const resolved = runtime.resolve(ctx)
	const Component = resolved.Component
	return <Component {...resolved.props} />
}
