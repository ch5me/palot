import type { PalotResolverResult } from "../shared/palot-bridge-schemas"
import { palotResolverResultSchema } from "../shared/palot-bridge-schemas"
import { getBrowserStateSnapshot, getSessionBinding } from "./palot-browser-ipc"

export function resolvePalotSessionBinding(opencodeSessionId: string): PalotResolverResult {
	const binding = getSessionBinding(opencodeSessionId)
	if (!binding) {
		return palotResolverResultSchema.parse({
			binding: null,
			nonSecretSnapshot: null,
			opaqueActionTarget: null,
		})
	}
	const snapshot = getBrowserStateSnapshot(opencodeSessionId)
	return palotResolverResultSchema.parse({
		binding,
		nonSecretSnapshot: snapshot,
		opaqueActionTarget: {
			bindingId: binding.id,
			laneId: binding.browserLaneId,
			magicBrowserSessionId: binding.magicBrowserSessionId,
		},
	})
}
