import type { BrowserStateSnapshot } from "../preload/api"
import { getBrowserStateSnapshot, getSessionBinding } from "./palot-browser-ipc"

export interface PalotResolverResult {
	binding: ReturnType<typeof getSessionBinding>
	nonSecretSnapshot: BrowserStateSnapshot | null
	opaqueActionTarget: {
		bindingId: string
		laneId: string | null
		magicBrowserSessionId: string | null
	} | null
}

export function resolvePalotSessionBinding(opencodeSessionId: string): PalotResolverResult {
	const binding = getSessionBinding(opencodeSessionId)
	if (!binding) {
		return {
			binding: null,
			nonSecretSnapshot: null,
			opaqueActionTarget: null,
		}
	}
	const snapshot = getBrowserStateSnapshot(opencodeSessionId)
	return {
		binding,
		nonSecretSnapshot: snapshot,
		opaqueActionTarget: {
			bindingId: binding.id,
			laneId: binding.browserLaneId,
			magicBrowserSessionId: binding.magicBrowserSessionId,
		},
	}
}
