import type { ReactNode } from "react"
import type { SurfaceController } from "./controller"
import { passiveController } from "./controllers/passive-controller"
import type { ReversePortalTransport } from "./transport-reverse-portal"
import type { DockPanelRecord, DockZone, SurfaceInstance, SurfaceVisibility } from "./types"

/**
 * Factory describing how to create a surface the first time its stable identity
 * is requested. The `render` thunk produces the surface's React tree, mounted
 * exactly once into the hidden host layer.
 */
export interface SurfaceFactory {
	type: SurfaceInstance["type"]
	title: string
	render: () => ReactNode
	/** Defaults to the passive controller when omitted. */
	controller?: SurfaceController
}

interface RegistryRecord {
	instance: SurfaceInstance
	controller: SurfaceController
	/** The currently attached visible slot, if any. */
	slotEl: HTMLElement | null
}

type Listener = () => void

/**
 * App-owned Surface Host Registry. Owns the durable `Map<instanceId,
 * SurfaceInstance>`, a controller per instance, the active {@link ReversePortalTransport},
 * and the {@link DockPanelRecord} table. Dockview never owns heavy content
 * lifetime — it only references surfaces by id through this registry.
 *
 * `getOrCreate` is idempotent (StrictMode-safe): calling it twice for the same
 * instanceId returns the existing instance and does not remount. A dock move
 * updates `DockPanelRecord.zone` only — it never recreates the SurfaceInstance.
 */
export class SurfaceRegistry {
	private readonly records = new Map<string, RegistryRecord>()
	private readonly dockPanels = new Map<string, DockPanelRecord>()
	private readonly listeners = new Set<Listener>()
	private instanceOrder: readonly string[] = []

	constructor(private readonly transport: ReversePortalTransport) {}

	/** The active transport (exposed so the host layer / outlets can render through it). */
	get surfaceTransport(): ReversePortalTransport {
		return this.transport
	}

	/**
	 * Get an existing surface by stable identity, or create it once from `factory`.
	 * Idempotent: a second call for a live instanceId is a no-op that returns the
	 * existing instance (StrictMode double-invoke safe).
	 */
	getOrCreate(instanceId: string, factory: SurfaceFactory): SurfaceInstance {
		const existing = this.records.get(instanceId)
		if (existing) return existing.instance

		const instance: SurfaceInstance = {
			instanceId,
			type: factory.type,
			title: factory.title,
			createdAt: Date.now(),
			retainCount: 0,
			visibility: "hidden",
		}
		this.records.set(instanceId, {
			instance,
			controller: factory.controller ?? passiveController,
			slotEl: null,
		})
		this.transport.createNode(instanceId)
		this.transport.mount(instanceId, factory.render())
		this.instanceOrder = Array.from(this.records.keys())
		this.notify()
		return instance
	}

	/** Attach a visible slot element to a surface. Begins projecting; never recreates the host. */
	attachSlot(instanceId: string, el: HTMLElement): void {
		const record = this.records.get(instanceId)
		if (!record) return
		record.slotEl = el
		record.instance.retainCount += 1
		record.instance.visibility = "visible"
		record.instance.lastFocusedAt = Date.now()
		this.transport.attach(instanceId, el)
		record.controller.onAttach(el)
		record.controller.onVisible()
		this.notify()
	}

	/**
	 * Detach the visible slot from a surface. DETACH, never destroy: the host
	 * stays mounted in the hidden layer and all surface state survives.
	 */
	detachSlot(instanceId: string): void {
		const record = this.records.get(instanceId)
		if (!record) return
		record.slotEl = null
		record.instance.retainCount = Math.max(0, record.instance.retainCount - 1)
		record.instance.visibility = record.instance.retainCount > 0 ? "visible" : "detached"
		this.transport.detach(instanceId)
		record.controller.onDetach()
		if (record.instance.visibility === "detached") record.controller.onHidden()
		this.notify()
	}

	/** Update a surface's visibility flag and fire the matching controller hook. */
	setVisibility(instanceId: string, visibility: SurfaceVisibility): void {
		const record = this.records.get(instanceId)
		if (!record || record.instance.visibility === visibility) return
		record.instance.visibility = visibility
		if (visibility === "visible") record.controller.onVisible()
		else record.controller.onHidden()
		this.notify()
	}

	/** Notify the registry that a visible slot resized → route to the controller. */
	reportResize(instanceId: string, rect: DOMRectReadOnly): void {
		const record = this.records.get(instanceId)
		if (!record) return
		record.instance.layout = {
			width: rect.width,
			height: rect.height,
			dpr: typeof window !== "undefined" ? window.devicePixelRatio : 1,
		}
		record.controller.onResize(rect)
	}

	/**
	 * Record (or update) a Dockview panel → surface binding. A dock MOVE only
	 * updates `zone`; it never touches the underlying SurfaceInstance.
	 */
	recordDockMove(dockPanelId: string, zone: DockZone): void {
		const record = this.dockPanels.get(dockPanelId)
		if (!record || record.zone === zone) return
		record.zone = zone
		this.notify()
	}

	/** Register a Dockview panel record (first time a panel binds to a surface). */
	registerDockPanel(record: DockPanelRecord): void {
		this.dockPanels.set(record.dockPanelId, record)
		this.notify()
	}

	/** Remove a Dockview panel binding (panel closed). Does NOT destroy the surface. */
	removeDockPanel(dockPanelId: string): void {
		if (this.dockPanels.delete(dockPanelId)) this.notify()
	}

	/** Permanently destroy a surface — tear down host + controller. */
	evict(instanceId: string): void {
		const record = this.records.get(instanceId)
		if (!record) return
		record.controller.onDestroy()
		this.transport.destroy(instanceId)
		this.records.delete(instanceId)
		this.instanceOrder = Array.from(this.records.keys())
		this.notify()
	}

	/** Look up a live surface instance. */
	getInstance(instanceId: string): SurfaceInstance | undefined {
		return this.records.get(instanceId)?.instance
	}

	/** Read-only snapshot of the instance map (durable source of truth). */
	get instances(): ReadonlyMap<string, SurfaceInstance> {
		const out = new Map<string, SurfaceInstance>()
		for (const [id, record] of this.records) out.set(id, record.instance)
		return out
	}

	/** Read-only snapshot of the Dockview panel table. */
	get dockPanelRecords(): ReadonlyMap<string, DockPanelRecord> {
		return this.dockPanels
	}

	/** Subscribe to registry changes (for `useSyncExternalStore`). */
	subscribe(listener: Listener): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	/** Stable-identity ordered list of live instance ids (host-layer iteration order). */
	getInstanceOrder(): readonly string[] {
		return this.instanceOrder
	}

	private notify(): void {
		for (const listener of this.listeners) listener()
	}
}
