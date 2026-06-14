export const STABLE_PANEL_HOST_STATES = [
	"detached",
	"attaching",
	"attached",
	"suspended",
	"unavailable",
] as const

export type StablePanelHostState = (typeof STABLE_PANEL_HOST_STATES)[number]

export type StablePanelHostId = string
export type StablePanelAttachmentId = string

export interface StablePanelAttachmentTarget {
	attachmentId: StablePanelAttachmentId
	visible: boolean
	zoneId?: string
}

export interface StablePanelSize {
	width: number
	height: number
}

export interface StablePanelHostLifecycle {
	onAttach?: (target: StablePanelAttachmentTarget) => void
	onDetach?: (target: StablePanelAttachmentTarget | null) => void
	onVisibilityChange?: (visible: boolean, target: StablePanelAttachmentTarget | null) => void
	onResize?: (size: StablePanelSize, target: StablePanelAttachmentTarget | null) => void
}

export interface StablePanelHostInstrumentation {
	mode?: "remember" | "warn" | "error"
	logger?: Pick<Console, "warn">
}

export interface SurfaceTransportHandle {
	hostId: StablePanelHostId
}

export interface SurfaceTransport<Handle extends SurfaceTransportHandle = SurfaceTransportHandle> {
	readonly kind: string
	createHost: (hostId: StablePanelHostId) => Handle
	attachHost: (handle: Handle, target: StablePanelAttachmentTarget) => void
	detachHost: (handle: Handle, target: StablePanelAttachmentTarget | null) => void
	resizeHost?: (handle: Handle, size: StablePanelSize) => void
	disposeHost?: (handle: Handle) => void
}

export interface StablePanelHostDefinition<
	Handle extends SurfaceTransportHandle = SurfaceTransportHandle,
> {
	hostId: StablePanelHostId
	transport: SurfaceTransport<Handle>
	hiddenMode?: "keep-attached" | "suspend"
	lifecycle?: StablePanelHostLifecycle
	instrumentation?: StablePanelHostInstrumentation
}

export interface StablePanelHostSnapshot<
	Handle extends SurfaceTransportHandle = SurfaceTransportHandle,
> {
	hostId: StablePanelHostId
	state: StablePanelHostState
	hiddenMode: "keep-attached" | "suspend"
	activeTarget: StablePanelAttachmentTarget | null
	lastVisibleTarget: StablePanelAttachmentTarget | null
	lastSize: StablePanelSize | null
	visible: boolean
	mountCount: number
	remountDetected: boolean
	lastError: string | null
	handle: Handle
	transportKind: string
}

interface StablePanelHostRecord<Handle extends SurfaceTransportHandle>
	extends StablePanelHostSnapshot<Handle> {
	lifecycle: StablePanelHostLifecycle
	instrumentation: Required<StablePanelHostInstrumentation>
	transport: SurfaceTransport<Handle>
}

const DEFAULT_HIDDEN_MODE = "suspend" as const

function defaultLogger(): Pick<Console, "warn"> {
	return console
}

function normalizeInstrumentation(
	instrumentation?: StablePanelHostInstrumentation,
): Required<StablePanelHostInstrumentation> {
	return {
		mode: instrumentation?.mode ?? "remember",
		logger: instrumentation?.logger ?? defaultLogger(),
	}
}

function cloneTarget(target: StablePanelAttachmentTarget | null): StablePanelAttachmentTarget | null {
	if (!target) {
		return null
	}

	return { ...target }
}

function cloneSize(size: StablePanelSize | null): StablePanelSize | null {
	if (!size) {
		return null
	}

	return { ...size }
}

function remountMessage(hostId: StablePanelHostId, count: number): string {
	return `stable host ${hostId} remounted unexpectedly (${count} mounts observed)`
}

function sameAttachmentTarget(
	left: StablePanelAttachmentTarget | null,
	right: StablePanelAttachmentTarget | null,
): boolean {
	if (!left || !right) {
		return left === right
	}

	return (
		left.attachmentId === right.attachmentId &&
		left.visible === right.visible &&
		left.zoneId === right.zoneId
	)
}

export class StablePanelHostRuntime<
	Handle extends SurfaceTransportHandle = SurfaceTransportHandle,
> {
	private readonly hosts = new Map<StablePanelHostId, StablePanelHostRecord<Handle>>()

	registerHost(definition: StablePanelHostDefinition<Handle>): StablePanelHostSnapshot<Handle> {
		const existing = this.hosts.get(definition.hostId)
		if (existing) {
			return this.snapshotFromRecord(existing)
		}

		const handle = definition.transport.createHost(definition.hostId)
		const record: StablePanelHostRecord<Handle> = {
			hostId: definition.hostId,
			state: "detached",
			hiddenMode: definition.hiddenMode ?? DEFAULT_HIDDEN_MODE,
			activeTarget: null,
			lastVisibleTarget: null,
			lastSize: null,
			visible: false,
			mountCount: 0,
			remountDetected: false,
			lastError: null,
			handle,
			transportKind: definition.transport.kind,
			lifecycle: definition.lifecycle ?? {},
			instrumentation: normalizeInstrumentation(definition.instrumentation),
			transport: definition.transport,
		}

		this.hosts.set(definition.hostId, record)
		return this.snapshotFromRecord(record)
	}

	attachHost(
		hostId: StablePanelHostId,
		target: StablePanelAttachmentTarget,
	): StablePanelHostSnapshot<Handle> {
		const record = this.requireHost(hostId)
		const priorTarget = cloneTarget(record.activeTarget)
		const nextTarget = { ...target }
		const nextVisible = nextTarget.visible
		const shouldSuspend = !nextVisible && record.hiddenMode === "suspend"
		const targetChanged = !sameAttachmentTarget(priorTarget, nextTarget)

		try {
			record.state = "attaching"
			record.lastError = null

			if (targetChanged && priorTarget) {
				record.transport.detachHost(record.handle, priorTarget)
				record.lifecycle.onVisibilityChange?.(false, cloneTarget(priorTarget))
				record.lifecycle.onDetach?.(cloneTarget(priorTarget))
			}

			if (shouldSuspend) {
				record.activeTarget = cloneTarget(nextTarget)
				record.visible = false
				record.state = "suspended"
				if (!targetChanged) {
					record.transport.detachHost(record.handle, nextTarget)
					record.lifecycle.onVisibilityChange?.(false, cloneTarget(nextTarget))
					record.lifecycle.onDetach?.(cloneTarget(nextTarget))
				}
				return this.snapshotFromRecord(record)
			}

			record.transport.attachHost(record.handle, nextTarget)
			record.activeTarget = cloneTarget(nextTarget)
			record.visible = nextVisible
			if (nextVisible) {
				record.lastVisibleTarget = cloneTarget(nextTarget)
			}
			record.state = "attached"
			record.lifecycle.onAttach?.(cloneTarget(nextTarget) as StablePanelAttachmentTarget)
			record.lifecycle.onVisibilityChange?.(nextVisible, cloneTarget(nextTarget))
			return this.snapshotFromRecord(record)
		} catch (error) {
			record.state = "unavailable"
			record.lastError = error instanceof Error ? error.message : String(error)
			return this.snapshotFromRecord(record)
		}
	}

	detachHost(hostId: StablePanelHostId): StablePanelHostSnapshot<Handle> {
		const record = this.requireHost(hostId)
		const priorTarget = cloneTarget(record.activeTarget)

		try {
			record.transport.detachHost(record.handle, priorTarget)
			record.lifecycle.onVisibilityChange?.(false, priorTarget)
			record.lifecycle.onDetach?.(priorTarget)
			record.activeTarget = null
			record.visible = false
			record.state = "detached"
			record.lastError = null
			return this.snapshotFromRecord(record)
		} catch (error) {
			record.state = "unavailable"
			record.lastError = error instanceof Error ? error.message : String(error)
			return this.snapshotFromRecord(record)
		}
	}

	resizeHost(hostId: StablePanelHostId, size: StablePanelSize): StablePanelHostSnapshot<Handle> {
		const record = this.requireHost(hostId)
		record.lastSize = { ...size }
		record.transport.resizeHost?.(record.handle, size)
		record.lifecycle.onResize?.({ ...size }, cloneTarget(record.activeTarget))
		return this.snapshotFromRecord(record)
	}

	recordMount(hostId: StablePanelHostId): StablePanelHostSnapshot<Handle> {
		const record = this.requireHost(hostId)
		record.mountCount += 1
		if (record.mountCount > 1) {
			record.remountDetected = true
			const message = remountMessage(hostId, record.mountCount)
			if (record.instrumentation.mode === "warn") {
				record.instrumentation.logger.warn(message)
			}
			if (record.instrumentation.mode === "error") {
				throw new Error(message)
			}
		}

		return this.snapshotFromRecord(record)
	}

	getSnapshot(hostId: StablePanelHostId): StablePanelHostSnapshot<Handle> {
		return this.snapshotFromRecord(this.requireHost(hostId))
	}

	listSnapshots(): StablePanelHostSnapshot<Handle>[] {
		return [...this.hosts.values()].map((record) => this.snapshotFromRecord(record))
	}

	disposeHost(hostId: StablePanelHostId): void {
		const record = this.requireHost(hostId)
		record.transport.disposeHost?.(record.handle)
		this.hosts.delete(hostId)
	}

	private requireHost(hostId: StablePanelHostId): StablePanelHostRecord<Handle> {
		const record = this.hosts.get(hostId)
		if (!record) {
			throw new Error(`unknown stable panel host: ${hostId}`)
		}

		return record
	}

	private snapshotFromRecord(record: StablePanelHostRecord<Handle>): StablePanelHostSnapshot<Handle> {
		return {
			hostId: record.hostId,
			state: record.state,
			hiddenMode: record.hiddenMode,
			activeTarget: cloneTarget(record.activeTarget),
			lastVisibleTarget: cloneTarget(record.lastVisibleTarget),
			lastSize: cloneSize(record.lastSize),
			visible: record.visible,
			mountCount: record.mountCount,
			remountDetected: record.remountDetected,
			lastError: record.lastError,
			handle: record.handle,
			transportKind: record.transportKind,
		}
	}
}

export function supportsMoveBeforeTransport(): boolean {
	if (typeof Element === "undefined") {
		return false
	}

	return typeof (Element.prototype as Element & { moveBefore?: unknown }).moveBefore === "function"
}
