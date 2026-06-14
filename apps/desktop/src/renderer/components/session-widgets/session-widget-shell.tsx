import {
	type DragEndEvent,
	type DragStartEvent,
	DndContext,
	DragOverlay,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Tooltip, TooltipContent, TooltipTrigger } from "@ch5me/elf-ui/components/tooltip"
import { cn } from "@ch5me/elf-ui/lib/utils"
import { useAtomValue, useSetAtom } from "jotai"
import { GripVerticalIcon } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import {
	activeWidgetDragAtom,
	moveSessionWidgetAtom,
	rehomeInlineWidgetsAtom,
	sessionWidgetLayoutFamily,
	type SessionWidgetId,
	type SessionWidgetZoneId,
} from "../../atoms/session-widgets"
import {
	renderSessionWidgetRuntime,
	resolveSessionWidgetDescriptor,
	SESSION_WIDGET_REGISTRY,
} from "../../session-widget-registry"
import type { Agent } from "../../lib/types"

const INLINE_RIGHT_MIN_WIDTH = 1320
const INLINE_RIGHT_DISABLE_WIDTH = 1180

interface SessionWidgetWorkspaceProps {
	agent: Agent
	sidePanelOpen: boolean
	children: ReactNode
}

interface SessionWidgetZoneProps {
	agent: Agent
	zoneId: SessionWidgetZoneId
	showDropHint: boolean
}

interface SessionWidgetCardProps {
	agent: Agent
	widgetId: SessionWidgetId
	zoneId: SessionWidgetZoneId
}

export function SessionWidgetWorkspace({ agent, sidePanelOpen, children }: SessionWidgetWorkspaceProps) {
	const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
	const [workspaceWidth, setWorkspaceWidth] = useState(0)
	const [inlineRightEnabled, setInlineRightEnabled] = useState(false)
	const activeDrag = useAtomValue(activeWidgetDragAtom)
	const rehomeInlineWidgets = useSetAtom(rehomeInlineWidgetsAtom)
	const moveSessionWidget = useSetAtom(moveSessionWidgetAtom)
	const setActiveWidgetDrag = useSetAtom(activeWidgetDragAtom)
	const layout = useAtomValue(sessionWidgetLayoutFamily(agent.sessionId))
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

	useEffect(() => {
		if (!containerEl) {
			return
		}

		const observer = new ResizeObserver((entries) => {
			const nextWidth = entries[0]?.contentRect.width ?? 0
			setWorkspaceWidth(nextWidth)
		})
		observer.observe(containerEl)
		return () => observer.disconnect()
	}, [containerEl])

	useEffect(() => {
		if (sidePanelOpen) {
			setInlineRightEnabled(false)
			return
		}

		setInlineRightEnabled((prev) => {
			if (prev) {
				return workspaceWidth >= INLINE_RIGHT_DISABLE_WIDTH
			}
			return workspaceWidth >= INLINE_RIGHT_MIN_WIDTH
		})
	}, [sidePanelOpen, workspaceWidth])

	useEffect(() => {
		if (!inlineRightEnabled) {
			rehomeInlineWidgets(agent.sessionId)
		}
	}, [agent.sessionId, inlineRightEnabled, rehomeInlineWidgets])

	const handleDragStart = useCallback(
		(event: DragStartEvent) => {
			const widgetId = event.active.data.current?.widgetId as SessionWidgetId | undefined
			const sourceZoneId = event.active.data.current?.zoneId as SessionWidgetZoneId | undefined
			if (!widgetId || !sourceZoneId) {
				return
			}
			setActiveWidgetDrag({ widgetId, sessionId: agent.sessionId, sourceZoneId })
		},
		[agent.sessionId, setActiveWidgetDrag],
	)

	const handleDragEnd = useCallback(
		(event: DragEndEvent) => {
			const widgetId = event.active.data.current?.widgetId as SessionWidgetId | undefined
			const sourceZoneId = event.active.data.current?.zoneId as SessionWidgetZoneId | undefined
			const targetZoneId = event.over?.data.current?.zoneId as SessionWidgetZoneId | undefined
			if (widgetId && sourceZoneId && targetZoneId) {
				moveSessionWidget({
					sessionId: agent.sessionId,
					widgetId,
					fromZoneId: sourceZoneId,
					toZoneId: targetZoneId,
				})
			}
			setActiveWidgetDrag(null)
		},
		[agent.sessionId, moveSessionWidget, setActiveWidgetDrag],
	)

	const overlayWidget = activeDrag ? SESSION_WIDGET_REGISTRY[activeDrag.widgetId] : null
	const showInlineRightZone = inlineRightEnabled || layout.placement["chat-inline-right"].length > 0 || !!activeDrag

	return (
		<DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
			<div
				ref={setContainerEl}
				className={cn(
					"flex h-full min-h-0 min-w-0 flex-col",
					showInlineRightZone ? "xl:flex-row xl:items-stretch xl:gap-4" : undefined,
				)}
			>
				<div className="flex min-h-0 min-w-0 flex-1 flex-col xl:min-w-0">
					<SessionWidgetZone agent={agent} zoneId="above-chat" showDropHint={!!activeDrag} />
					<div className="min-h-0 min-w-0 flex-1">{children}</div>
				</div>

				{showInlineRightZone && (
					<div className="mt-3 w-full shrink-0 xl:mt-0 xl:w-72 2xl:w-80">
						<SessionWidgetZone
							agent={agent}
							zoneId="chat-inline-right"
							showDropHint={!!activeDrag}
						/>
					</div>
				)}
			</div>

			<DragOverlay>
				{overlayWidget ? (
					<WidgetPreview
						title={resolveSessionWidgetDescriptor(overlayWidget, { agent }).title}
						icon={resolveSessionWidgetDescriptor(overlayWidget, { agent }).icon}
					/>
				) : null}
			</DragOverlay>
		</DndContext>
	)
}

export function SessionWidgetZone({ agent, zoneId, showDropHint }: SessionWidgetZoneProps) {
	const layout = useAtomValue(sessionWidgetLayoutFamily(agent.sessionId))
	const widgetIds = layout.placement[zoneId]
	const droppableId = `${agent.sessionId}:${zoneId}`
	const { isOver, setNodeRef } = useDroppable({
		id: droppableId,
		data: { zoneId },
	})
	const isInlineRight = zoneId === "chat-inline-right"
	const hasWidgets = widgetIds.length > 0
	const shouldRender = hasWidgets || showDropHint
	const showDropState = showDropHint && !hasWidgets

	if (!shouldRender) {
		return null
	}

	return (
		<div
			ref={setNodeRef}
			className={cn(
				"transition-colors duration-200",
				isInlineRight ? "h-full min-h-[160px] rounded-xl" : "mb-2",
				showDropState ? "border border-dashed border-border/60 bg-muted/10" : undefined,
				isOver ? "border border-emerald-400/60 bg-emerald-500/10" : undefined,
			)}
		>
			{hasWidgets ? (
				<div className={cn("space-y-2", isInlineRight ? "h-full" : undefined)}>
					{widgetIds.map((widgetId) => (
						<SessionWidgetCard key={`${zoneId}:${widgetId}`} agent={agent} widgetId={widgetId} zoneId={zoneId} />
					))}
				</div>
			) : showDropState ? (
				<div
					className={cn(
						"flex h-full min-h-[120px] items-center justify-center rounded-xl px-4 py-6 text-center text-xs text-muted-foreground",
						isInlineRight ? "xl:min-h-[240px]" : undefined,
					)}
				>
					Drop widget here
				</div>
			) : null}
		</div>
	)
}

	export function SessionWidgetCard({ agent, widgetId, zoneId }: SessionWidgetCardProps) {
		const widget = SESSION_WIDGET_REGISTRY[widgetId]
		const descriptor = resolveSessionWidgetDescriptor(widget, { agent })
		const dragId = `${agent.sessionId}:${zoneId}:${widgetId}`
	const labelId = useId()
	const { attributes, isDragging, listeners, setNodeRef, transform } = useDraggable({
		id: dragId,
		data: { widgetId, zoneId },
	})

	const style = useMemo(
		() => ({
			transform: CSS.Translate.toString(transform),
		}),
		[transform],
	)

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"rounded-xl border border-border/40 bg-background/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60",
				isDragging ? "opacity-45" : undefined,
			)}
		>
			<div className="flex items-center gap-2 border-b border-border/40 px-2.5 py-1.5">
				<Tooltip>
					<TooltipTrigger
						render={
							<button
								type="button"
								className="flex shrink-0 cursor-grab items-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
								aria-labelledby={labelId}
								{...listeners}
								{...attributes}
							/>
						}
					>
						<GripVerticalIcon className="size-3.5" />
					</TooltipTrigger>
					<TooltipContent side="top">Drag widget</TooltipContent>
				</Tooltip>
				<div className="min-w-0 flex-1">
					<p id={labelId} className="truncate text-[11px] font-medium text-foreground/80">
						{descriptor.title}
					</p>
				</div>
			</div>
			<div className="p-1.5">{renderSessionWidgetRuntime(descriptor.runtime, { agent })}</div>
		</div>
	)
}

function WidgetPreview({
	title,
	icon: Icon,
}: {
	title: string
	icon: typeof GripVerticalIcon
}) {
	return (
		<div className="flex w-64 items-center gap-2 rounded-xl border border-border/60 bg-background/90 px-3 py-2 shadow-lg backdrop-blur">
			<Icon className="size-4 text-muted-foreground" />
			<span className="truncate text-sm font-medium text-foreground">{title}</span>
		</div>
	)
}
