import type { SurfaceController } from "../controller"

/**
 * Default no-op controller for lightweight surfaces. Preserves nothing special:
 * correctness relies entirely on the host staying mounted in the hidden layer
 * across attach/detach (no widget re-layout, no resource hand-off needed).
 *
 * Heavier surfaces (Monaco, xterm, iframe, chat) get dedicated controllers.
 */
export class PassiveController implements SurfaceController {
	onAttach(_slotEl: HTMLElement): void {}
	onDetach(): void {}
	onVisible(): void {}
	onHidden(): void {}
	onResize(_rect: DOMRectReadOnly): void {}
	onFocusRequest(_reason: string): void {}
	onDestroy(): void {}
}

/** Shared singleton — passive controllers carry no per-instance state. */
export const passiveController: SurfaceController = new PassiveController()
