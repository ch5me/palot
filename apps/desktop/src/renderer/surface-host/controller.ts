/**
 * Per-surface lifecycle hooks. A controller carries the type-specific knowledge
 * needed to survive attach/detach and zone moves (Monaco re-layout, xterm fit,
 * iframe preservation, semantic scroll restore, focus). The registry calls these
 * as a surface moves between slots and visibility states.
 *
 * Heavy resource lifetime (PTY, Monaco model, iframe, stream) lives OUTSIDE the
 * widget, keyed by the underlying resource — the controller never destroys that
 * resource on {@link SurfaceController.onDetach}; only {@link SurfaceController.onDestroy}
 * may release it.
 */
export interface SurfaceController {
	/** Slot became the active projection target. */
	onAttach(slotEl: HTMLElement): void
	/** Slot stopped projecting. Host stays mounted; never tear down resources here. */
	onDetach(): void
	/** Surface is now user-visible. */
	onVisible(): void
	/** Surface is hidden but still mounted. */
	onHidden(): void
	/** Visible slot resized (Dockview layout → ResizeObserver → here). */
	onResize(rect: DOMRectReadOnly): void
	/** Explicit focus request routed through the focus service. */
	onFocusRequest(reason: string): void
	/** Surface is being evicted/destroyed — release any owned resources. */
	onDestroy(): void
}
