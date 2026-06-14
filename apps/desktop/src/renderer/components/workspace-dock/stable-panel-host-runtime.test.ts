import { describe, expect, test } from "bun:test"
import {
	StablePanelHostRuntime,
	type StablePanelAttachmentTarget,
	type StablePanelSize,
	type SurfaceTransport,
	type SurfaceTransportHandle,
	supportsMoveBeforeTransport,
} from "./stable-panel-host-runtime"

interface FakeHandle extends SurfaceTransportHandle {
	attachmentIds: string[]
	resizeEvents: StablePanelSize[]
	detachCount: number
}

function createFakeTransport(log: string[]): SurfaceTransport<FakeHandle> {
	return {
		kind: "fake",
		createHost: (hostId) => ({
			hostId,
			attachmentIds: [],
			resizeEvents: [],
			detachCount: 0,
		}),
		attachHost: (handle, target) => {
			handle.attachmentIds.push(target.attachmentId)
			log.push(`transport:attach:${target.attachmentId}:${target.visible ? "visible" : "hidden"}`)
		},
		detachHost: (handle, target) => {
			handle.detachCount += 1
			log.push(`transport:detach:${target?.attachmentId ?? "none"}`)
		},
		resizeHost: (handle, size) => {
			handle.resizeEvents.push({ ...size })
			log.push(`transport:resize:${size.width}x${size.height}`)
		},
	}
}

function target(attachmentId: string, visible = true): StablePanelAttachmentTarget {
	return {
		attachmentId,
		visible,
		zoneId: attachmentId.startsWith("right") ? "side-panel" : "main-pane",
	}
}

describe("StablePanelHostRuntime", () => {
	test("reattaches a protected host without remounting", () => {
		const log: string[] = []
		const runtime = new StablePanelHostRuntime<FakeHandle>()
		runtime.registerHost({
			hostId: "host:chat",
			transport: createFakeTransport(log),
			instrumentation: { mode: "error" },
		})

		runtime.recordMount("host:chat")
		runtime.attachHost("host:chat", target("main-slot-a"))
		const moved = runtime.attachHost("host:chat", target("right-slot-b"))

		expect(moved.mountCount).toBe(1)
		expect(moved.remountDetected).toBe(false)
		expect(moved.state).toBe("attached")
		expect(moved.activeTarget?.attachmentId).toBe("right-slot-b")
		expect(moved.handle.attachmentIds).toEqual(["main-slot-a", "right-slot-b"])
		expect(log).toEqual([
			"transport:attach:main-slot-a:visible",
			"transport:attach:right-slot-b:visible",
		])
	})

	test("fires lifecycle callbacks in stable order across hide, show, resize, and detach", () => {
		const log: string[] = []
		const runtime = new StablePanelHostRuntime<FakeHandle>()
		runtime.registerHost({
			hostId: "host:surface",
			transport: createFakeTransport(log),
			hiddenMode: "suspend",
			lifecycle: {
				onAttach: (nextTarget) => log.push(`callback:attach:${nextTarget.attachmentId}`),
				onDetach: (nextTarget) => log.push(`callback:detach:${nextTarget?.attachmentId ?? "none"}`),
				onVisibilityChange: (visible, nextTarget) =>
					log.push(`callback:visible:${visible ? "true" : "false"}:${nextTarget?.attachmentId ?? "none"}`),
				onResize: (size, nextTarget) =>
					log.push(`callback:resize:${size.width}x${size.height}:${nextTarget?.attachmentId ?? "none"}`),
			},
		})

		runtime.attachHost("host:surface", target("main-slot-a"))
		runtime.resizeHost("host:surface", { width: 480, height: 320 })
		const suspended = runtime.attachHost("host:surface", target("main-slot-a", false))
		const resumed = runtime.attachHost("host:surface", target("right-slot-b"))
		const detached = runtime.detachHost("host:surface")

		expect(suspended.state).toBe("suspended")
		expect(resumed.state).toBe("attached")
		expect(detached.state).toBe("detached")
		expect(detached.lastVisibleTarget?.attachmentId).toBe("right-slot-b")
		expect(log).toEqual([
			"transport:attach:main-slot-a:visible",
			"callback:attach:main-slot-a",
			"callback:visible:true:main-slot-a",
			"transport:resize:480x320",
			"callback:resize:480x320:main-slot-a",
			"transport:detach:main-slot-a",
			"callback:visible:false:main-slot-a",
			"callback:detach:main-slot-a",
			"transport:attach:right-slot-b:visible",
			"callback:attach:right-slot-b",
			"callback:visible:true:right-slot-b",
			"transport:detach:right-slot-b",
			"callback:visible:false:right-slot-b",
			"callback:detach:right-slot-b",
		])
	})

	test("remount instrumentation remembers the violation for proof paths", () => {
		const warnings: string[] = []
		const runtime = new StablePanelHostRuntime<FakeHandle>()
		runtime.registerHost({
			hostId: "host:notes",
			transport: createFakeTransport([]),
			instrumentation: {
				mode: "warn",
				logger: { warn: (message) => warnings.push(message) },
			},
		})

		runtime.recordMount("host:notes")
		const snapshot = runtime.recordMount("host:notes")

		expect(snapshot.mountCount).toBe(2)
		expect(snapshot.remountDetected).toBe(true)
		expect(warnings).toEqual([
			"stable host host:notes remounted unexpectedly (2 mounts observed)",
		])
	})

	test("moveBefore transport feature detection stays explicit", () => {
		expect(typeof supportsMoveBeforeTransport()).toBe("boolean")
	})
})
