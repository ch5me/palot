import { describe, expect, test } from "bun:test"
import type { DockviewApi, DockviewGroupPanel, IDockviewPanel } from "dockview"

import { canDragSplitDockPanel } from "./split-dock-protection"
import { applySplitDockTransfer, createSplitDockPlacementState } from "./split-dock-placement-state"
import { StablePanelHostRuntime, type SurfaceTransport, type SurfaceTransportHandle } from "./stable-panel-host-runtime"

interface FakeHandle extends SurfaceTransportHandle {
	attachmentIds: string[]
	detachCount: number
}

function createFakeTransport(): SurfaceTransport<FakeHandle> {
	return {
		kind: "fake",
		createHost: (hostId) => ({
			hostId,
			attachmentIds: [],
			detachCount: 0,
		}),
		attachHost: (handle, target) => {
			handle.attachmentIds.push(`${target.zoneId ?? "unknown"}:${target.visible ? "visible" : "hidden"}`)
		},
		detachHost: (handle) => {
			handle.detachCount += 1
		},
	}
}

function panel(id: string, groupPanels: IDockviewPanel[]): IDockviewPanel {
	return {
		id,
		group: {
			panels: groupPanels,
		} as DockviewGroupPanel,
	} as IDockviewPanel
}

function api(panels: IDockviewPanel[]): DockviewApi {
	return { panels } as DockviewApi
}

describe("agent dock adapters", () => {
	test("blocks dragging the lone protected chat panel out of main", () => {
		const loneGroup: IDockviewPanel[] = []
		const loneChatPanel = panel("session-chat", loneGroup)
		loneGroup.push(loneChatPanel)

		expect(
			canDragSplitDockPanel({
				zone: "main",
				panel: loneChatPanel,
				api: api([loneChatPanel]),
				protection: { protected: true, requiredZone: "main" },
			}),
		).toBe(false)

		const pairedGroup: IDockviewPanel[] = []
		const firstChatPanel = panel("session-chat", pairedGroup)
		const secondChatPanel = panel("session-chat", pairedGroup)
		pairedGroup.push(firstChatPanel, secondChatPanel)

		expect(
			canDragSplitDockPanel({
				zone: "main",
				panel: firstChatPanel,
				api: api([firstChatPanel, secondChatPanel]),
				protection: { protected: true, requiredZone: "main" },
			}),
		).toBe(true)

		const surfaceGroup: IDockviewPanel[] = []
		const surfacePanel = panel("session-surface", surfaceGroup)
		surfaceGroup.push(surfacePanel)
		expect(
			canDragSplitDockPanel({
				zone: "right",
				panel: surfacePanel,
				api: api([surfacePanel]),
			}),
		).toBe(true)
	})

	test("right and bottom visibility toggles do not increment protected host mount count", () => {
		const runtime = new StablePanelHostRuntime<FakeHandle>()
		runtime.registerHost({
			hostId: "host:session-chat",
			transport: createFakeTransport(),
			hiddenMode: "keep-attached",
			instrumentation: { mode: "error" },
		})

		runtime.recordMount("host:session-chat")
		runtime.attachHost("host:session-chat", {
			attachmentId: "attachment:main:chat",
			visible: true,
			zoneId: "main",
		})

		for (let index = 0; index < 4; index += 1) {
			runtime.attachHost("host:session-chat", {
				attachmentId: "attachment:main:chat",
				visible: true,
				zoneId: "main",
			})
		}

		const snapshot = runtime.getSnapshot("host:session-chat")
		expect(snapshot.mountCount).toBe(1)
		expect(snapshot.remountDetected).toBe(false)
		expect(snapshot.activeTarget?.attachmentId).toBe("attachment:main:chat")
	})

	test("protected stable host zone moves keep mount count unchanged while attachment changes", () => {
		const runtime = new StablePanelHostRuntime<FakeHandle>()
		runtime.registerHost({
			hostId: "host:session-surface",
			transport: createFakeTransport(),
			hiddenMode: "keep-attached",
			instrumentation: { mode: "error" },
		})

		runtime.recordMount("host:session-surface")
		runtime.attachHost("host:session-surface", {
			attachmentId: "attachment:right:surface",
			visible: true,
			zoneId: "right",
		})

		const placement = createSplitDockPlacementState([{ id: "session-surface", zone: "right" }])
		const moved = applySplitDockTransfer(placement, {
			panelId: "session-surface",
			sourceZone: "right",
			targetZone: "bottom",
			policy: "move",
		})
		expect(moved).not.toBeNull()

		const snapshot = runtime.attachHost("host:session-surface", {
			attachmentId: "attachment:bottom:surface",
			visible: true,
			zoneId: moved?.panelZones["session-surface"],
		})

		expect(snapshot.mountCount).toBe(1)
		expect(snapshot.remountDetected).toBe(false)
		expect(snapshot.activeTarget?.attachmentId).toBe("attachment:bottom:surface")
	})
})
