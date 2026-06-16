import { atom } from "jotai"
import { atomFamily, atomWithStorage } from "jotai/utils"

export type SessionWidgetId = "session-task-list" | "genui-artifacts" | "devmux-toolbar"

export type SessionWidgetZoneId = "above-chat" | "chat-inline-right"

export interface SessionWidgetLayout {
	placement: Record<SessionWidgetZoneId, SessionWidgetId[]>
}

export interface ActiveWidgetDrag {
	widgetId: SessionWidgetId
	sessionId: string
	sourceZoneId: SessionWidgetZoneId
}

export interface SessionWidgetZoneAvailability {
	inlineRightEnabled: boolean
}

const DEFAULT_LAYOUT: SessionWidgetLayout = {
	placement: {
		"above-chat": ["devmux-toolbar", "session-task-list"],
		// Artifacts widget temporarily disabled (see session-widget-registry.tsx).
		// Inline-right starts empty; other widgets can still be dragged into it.
		"chat-inline-right": [],
	},
}

export const sessionWidgetLayoutStorageAtom = atomWithStorage<Record<string, SessionWidgetLayout>>(
	"elf:session-widget-layouts",
	{},
)

export const sessionWidgetLayoutFamily = atomFamily((sessionId: string) =>
	atom(
		(get) => get(sessionWidgetLayoutStorageAtom)[sessionId] ?? DEFAULT_LAYOUT,
		(get, set, nextLayout: SessionWidgetLayout) => {
			set(sessionWidgetLayoutStorageAtom, {
				...get(sessionWidgetLayoutStorageAtom),
				[sessionId]: nextLayout,
			})
		},
	),
)

export const activeWidgetDragAtom = atom<ActiveWidgetDrag | null>(null)

export const sessionWidgetZoneAvailabilityAtom = atom<SessionWidgetZoneAvailability>({
	inlineRightEnabled: false,
})

export const moveSessionWidgetAtom = atom(
	null,
	(
		get,
		set,
		args: {
			sessionId: string
			widgetId: SessionWidgetId
			fromZoneId: SessionWidgetZoneId
			toZoneId: SessionWidgetZoneId
		},
	) => {
		if (args.fromZoneId === args.toZoneId) {
			return
		}

		const layout = get(sessionWidgetLayoutFamily(args.sessionId))
		const nextPlacement: SessionWidgetLayout["placement"] = {
			"above-chat": [...layout.placement["above-chat"]],
			"chat-inline-right": [...layout.placement["chat-inline-right"]],
		}

		nextPlacement[args.fromZoneId] = nextPlacement[args.fromZoneId].filter(
			(widgetId) => widgetId !== args.widgetId,
		)
		if (!nextPlacement[args.toZoneId].includes(args.widgetId)) {
			nextPlacement[args.toZoneId].push(args.widgetId)
		}

		set(sessionWidgetLayoutFamily(args.sessionId), {
			placement: nextPlacement,
		})
	},
)

export const rehomeInlineWidgetsAtom = atom(null, (get, set, sessionId: string) => {
	const layout = get(sessionWidgetLayoutFamily(sessionId))
	const inlineWidgets = layout.placement["chat-inline-right"]
	if (inlineWidgets.length === 0) {
		return
	}

	const nextAboveChat = [...layout.placement["above-chat"]]
	for (const widgetId of inlineWidgets) {
		if (!nextAboveChat.includes(widgetId)) {
			nextAboveChat.push(widgetId)
		}
	}

	set(sessionWidgetLayoutFamily(sessionId), {
		placement: {
			"above-chat": nextAboveChat,
			"chat-inline-right": [],
		},
	})
})
