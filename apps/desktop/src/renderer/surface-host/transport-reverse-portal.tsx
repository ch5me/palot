import { type ReactNode, useSyncExternalStore } from "react"
import {
	createHtmlPortalNode,
	type HtmlPortalNode,
	InPortal,
	OutPortal,
} from "react-reverse-portal"
import type { SurfaceTransport } from "./transport"

/**
 * Per-instance transport state. The portal node is created once and lives for
 * the surface's whole lifetime; `element` is the host subtree rendered through
 * the InPortal; `container` is the slot currently projecting it (or null when
 * detached). The host stays mounted regardless of `container`.
 */
interface ReversePortalEntry {
	node: HtmlPortalNode
	element: ReactNode
	container: HTMLElement | null
}

type Listener = () => void

/**
 * {@link SurfaceTransport} backed by `react-reverse-portal`.
 *
 * This generalizes the proven pattern in `agent-detail.tsx`: each surface's
 * React tree mounts exactly once via an `InPortal` rendered in the hidden host
 * layer, and is projected into a visible slot via an `OutPortal`. Switching
 * which slot shows a surface moves its live DOM with no re-render and no state
 * loss.
 *
 * React ownership is kept clean by NOT spinning up a second React root inside
 * `attach`. Instead the transport exposes a small subscribable store; the
 * `HiddenSurfaceHostLayer` and `SurfaceOutlet` React components read it via
 * {@link ReversePortalTransport.useEntries} / {@link ReversePortalTransport.useEntry}
 * and render the `InPortal` / `OutPortal` declaratively. `attach`/`detach` only
 * record which container is active and notify subscribers.
 */
export class ReversePortalTransport implements SurfaceTransport {
	private readonly entries = new Map<string, ReversePortalEntry>()
	private readonly listeners = new Set<Listener>()
	private orderSnapshot: readonly string[] = []

	createNode(instanceId: string): void {
		if (this.entries.has(instanceId)) return
		this.entries.set(instanceId, {
			node: createHtmlPortalNode(),
			element: null,
			container: null,
		})
		this.bumpOrder()
		this.notify()
	}

	mount(instanceId: string, element: ReactNode): void {
		const entry = this.requireEntry(instanceId, "mount")
		entry.element = element
		this.notify()
	}

	attach(instanceId: string, container: HTMLElement): void {
		const entry = this.requireEntry(instanceId, "attach")
		if (entry.container === container) return
		entry.container = container
		this.notify()
	}

	detach(instanceId: string): void {
		const entry = this.entries.get(instanceId)
		// Detach is best-effort: the host stays mounted, we only stop projecting.
		if (!entry || entry.container === null) return
		entry.container = null
		this.notify()
	}

	destroy(instanceId: string): void {
		if (!this.entries.delete(instanceId)) return
		this.bumpOrder()
		this.notify()
	}

	/** Stable-ordered list of live instance ids, for the hidden host layer. */
	useEntries(): readonly string[] {
		return useSyncExternalStore(
			(listener) => this.subscribe(listener),
			() => this.orderSnapshot,
		)
	}

	/**
	 * Reactive view of a single surface's transport entry. Returns null until the
	 * node is created. Used by both the hidden host layer (renders the InPortal)
	 * and slots (render the OutPortal).
	 */
	useEntry(instanceId: string): ReversePortalEntry | null {
		return useSyncExternalStore(
			(listener) => this.subscribe(listener),
			() => this.entries.get(instanceId) ?? null,
		)
	}

	/** Render the persistent InPortal host for a surface. Mount once in the hidden layer. */
	renderHost(instanceId: string): ReactNode {
		const entry = this.entries.get(instanceId)
		if (!entry || entry.element === null) return null
		return <InPortal node={entry.node}>{entry.element}</InPortal>
	}

	/** Render an OutPortal projecting the surface into the current slot. */
	renderProjection(instanceId: string): ReactNode {
		const entry = this.entries.get(instanceId)
		if (!entry) return null
		return <OutPortal node={entry.node} />
	}

	private requireEntry(instanceId: string, op: string): ReversePortalEntry {
		const entry = this.entries.get(instanceId)
		if (!entry) {
			throw new Error(
				`ReversePortalTransport.${op}: no node for "${instanceId}" — call createNode first`,
			)
		}
		return entry
	}

	private subscribe(listener: Listener): () => void {
		this.listeners.add(listener)
		return () => {
			this.listeners.delete(listener)
		}
	}

	private bumpOrder(): void {
		this.orderSnapshot = Array.from(this.entries.keys())
	}

	private notify(): void {
		for (const listener of this.listeners) listener()
	}
}
