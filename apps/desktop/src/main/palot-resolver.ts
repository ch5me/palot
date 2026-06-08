import type { LoomSessionOpenResult, PalotResolverResult } from "../shared/palot-bridge-schemas"
import { palotResolverResultSchema } from "../shared/palot-bridge-schemas"
import { ensureLoomBridgeServer } from "./loom-bridge"
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

export async function openLoomSession(sessionId: string): Promise<LoomSessionOpenResult> {
	const bridge = await ensureLoomBridgeServer()
	return {
		session_id: sessionId,
		surface_url: bridge.surfaceUrl(sessionId),
		rev: 0,
	}
}
