/**
 * Session widget drawer — a style playground for the draggable widget cards
 * (`SessionWidgetCard`) and the zones / drawer that host them (`SessionWidgetZone`,
 * `SessionWidgetWorkspace`).
 *
 * These components read their layout from jotai and their bodies from the
 * SESSION_WIDGET_REGISTRY, and use @dnd-kit for drag/drop. So each story seeds a
 * fresh jotai store (a controlled layout + a representative task list) and
 * provides the DndContext the cards/zones require. Tweak the chrome in
 * `session-widget-shell.tsx` and every story below updates live.
 *
 * The "Widget card" story exposes `widgetId` / `zoneId` controls so you can flip
 * between the populated Task-list body and the DevMux card (whose body renders
 * empty here — it needs a live DevMux host — but the card chrome still shows).
 */

import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { createStore, Provider } from "jotai"
import { type ReactNode, useState } from "react"
import {
	type SessionWidgetLayout,
	sessionWidgetLayoutStorageAtom,
} from "../../atoms/session-widgets"
import { todosFamily } from "../../atoms/todos"
import type { Agent, Todo } from "../../lib/types"
import {
	SessionWidgetCard,
	SessionWidgetWorkspace,
	SessionWidgetZone,
} from "./session-widget-shell"

const SESSION_ID = "story-session"

const MOCK_TODOS: Todo[] = [
	{ content: "Wire the widget drawer layout", status: "completed", priority: "high" },
	{ content: "Restyle the draggable widget cards", status: "in_progress", priority: "high" },
	{ content: "Find a new home for the artifacts surface", status: "pending", priority: "medium" },
	{ content: "Retire the old inline-right column", status: "cancelled", priority: "low" },
]

const AGENT: Agent = {
	id: "story-agent",
	name: "Story Agent",
	status: "running",
	isAttached: true,
	presenceSource: "attach",
	visibilityReason: "visible",
	driftFlags: [],
	environment: "local",
	project: "palot",
	projectSlug: "palot",
	directory: "/Users/dev/src/palot",
	projectDirectory: "/Users/dev/src/palot",
	branch: "main",
	duration: "12m",
	activities: [],
	sessionId: SESSION_ID,
	permissions: [],
	questions: [],
	createdAt: 1_717_000_000_000,
	lastActiveAt: 1_717_000_600_000,
	lastContentActivityAt: 1_717_000_600_000,
	childSessionIds: [],
}

const layout = (
	aboveChat: SessionWidgetLayout["placement"]["above-chat"],
	inlineRight: SessionWidgetLayout["placement"]["chat-inline-right"],
): SessionWidgetLayout => ({
	placement: { "above-chat": aboveChat, "chat-inline-right": inlineRight },
})

const TASK_ONLY = layout(["session-task-list"], [])
const ABOVE_CHAT_STACK = layout(["session-task-list", "devmux-toolbar"], [])
const INLINE_RIGHT = layout([], ["session-task-list"])
const EMPTY = layout([], [])

/** Seeds a fresh jotai store (layout + todos) and, by default, the DndContext the cards/zones need. */
function WidgetStage({
	seededLayout,
	width = 760,
	dnd = true,
	children,
}: {
	seededLayout: SessionWidgetLayout
	width?: number
	dnd?: boolean
	children: ReactNode
}) {
	const [store] = useState(() => {
		const next = createStore()
		next.set(sessionWidgetLayoutStorageAtom, { [SESSION_ID]: seededLayout })
		next.set(todosFamily(SESSION_ID), MOCK_TODOS)
		return next
	})
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
	const body = (
		<div style={{ width }} className="p-4">
			{children}
		</div>
	)
	return (
		<Provider store={store}>
			{dnd ? <DndContext sensors={sensors}>{body}</DndContext> : body}
		</Provider>
	)
}

const meta = {
	title: "Session Widgets/Widget Drawer",
	component: SessionWidgetCard,
	parameters: { layout: "centered" },
	args: { agent: AGENT, widgetId: "session-task-list", zoneId: "above-chat" },
	argTypes: {
		widgetId: { control: "select", options: ["session-task-list", "devmux-toolbar"] },
		zoneId: { control: "select", options: ["above-chat", "chat-inline-right"] },
		agent: { table: { disable: true } },
	},
} satisfies Meta<typeof SessionWidgetCard>

export default meta
type Story = StoryObj<typeof meta>

/** A single draggable widget card. Use the controls to swap the body and home zone. */
export const WidgetCard: Story = {
	name: "Widget card",
	render: (args) => (
		<WidgetStage seededLayout={TASK_ONLY} width={420}>
			<SessionWidgetCard
				agent={AGENT}
				widgetId={args.widgetId ?? "session-task-list"}
				zoneId={args.zoneId ?? "above-chat"}
			/>
		</WidgetStage>
	),
}

/** The `above-chat` zone with several cards stacked — the default drawer over the chat input. */
export const ZoneAboveChat: Story = {
	name: "Zone · above chat",
	render: () => (
		<WidgetStage seededLayout={ABOVE_CHAT_STACK} width={640}>
			<SessionWidgetZone agent={AGENT} zoneId="above-chat" showDropHint={false} />
		</WidgetStage>
	),
}

/** The `chat-inline-right` zone as a tall side column next to the chat. */
export const ZoneInlineRight: Story = {
	name: "Zone · inline-right column",
	render: () => (
		<WidgetStage seededLayout={INLINE_RIGHT} width={320}>
			<div className="h-[420px]">
				<SessionWidgetZone agent={AGENT} zoneId="chat-inline-right" showDropHint={false} />
			</div>
		</WidgetStage>
	),
}

/** Empty zone with the drop hint active — the dashed "Drop widget here" target shown while dragging. */
export const ZoneDropTarget: Story = {
	name: "Zone · drop target",
	render: () => (
		<WidgetStage seededLayout={EMPTY} width={360}>
			<div className="h-[220px]">
				<SessionWidgetZone agent={AGENT} zoneId="chat-inline-right" showDropHint={true} />
			</div>
		</WidgetStage>
	),
}

/**
 * The full workspace drawer wrapping a chat placeholder. Drag a card by its grip
 * handle — the inline-right column appears as a live drop target while dragging.
 * `SessionWidgetWorkspace` provides its own DndContext, so the stage omits one.
 */
export const Workspace: Story = {
	name: "Full workspace drawer",
	parameters: { layout: "fullscreen" },
	render: () => (
		<WidgetStage seededLayout={ABOVE_CHAT_STACK} width={1100} dnd={false}>
			<SessionWidgetWorkspace agent={AGENT} sidePanelOpen={false}>
				<div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-border/40 text-sm text-muted-foreground">
					Chat area
				</div>
			</SessionWidgetWorkspace>
		</WidgetStage>
	),
}
