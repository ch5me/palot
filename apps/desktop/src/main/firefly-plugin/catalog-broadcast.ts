/**
 * Firefly Plugin System V2 — catalog-change broadcaster
 *
 * One place that tells every renderer "the plugin catalog moved; re-read
 * your projections." Both the lifecycle IPC handlers (enable/disable/
 * quarantine) and the dev hot-reload executor publish through this so
 * there is a single `firefly-plugin:changed` surface and the renderer's
 * catalog query invalidation has exactly one trigger.
 *
 * The default implementation fans the event out to every BrowserWindow;
 * the executor and tests inject a `CatalogBroadcaster` so the runtime
 * side-effect stays mockable.
 */

import { BrowserWindow } from "electron"

import { getPluginCatalog } from "./authority"

export const FIREFLY_PLUGIN_CHANGED_CHANNEL = "firefly-plugin:changed" as const

export interface CatalogChangedPayload {
	readonly appVersion: string
	readonly pluginCount: number
	/** Optional hint so the renderer can log/explain why the catalog moved. */
	readonly reason?: string
}

/** Publishes a catalog-changed event to all renderers. Injectable for tests. */
export type CatalogBroadcaster = (reason?: string) => void

/**
 * Default broadcaster: derive the current catalog summary and send it to
 * every open renderer. Safe to call any time; a window with no listeners
 * simply ignores the event.
 */
export function broadcastCatalogChanged(reason?: string): void {
	const catalog = getPluginCatalog()
	const payload: CatalogChangedPayload = {
		appVersion: catalog.appVersion,
		pluginCount: catalog.descriptors.length,
		...(reason ? { reason } : {}),
	}
	for (const win of BrowserWindow.getAllWindows()) {
		win.webContents.send(FIREFLY_PLUGIN_CHANGED_CHANNEL, payload)
	}
}
