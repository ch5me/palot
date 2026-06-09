import type { IpcMain } from "electron"

import type { GenUiArtifactPinState, GenUiArtifactRecord } from "../../renderer/lib/types"
import { getArtifactStore } from "./artifact-store"

export const PALOT_ARTIFACT_IPC_CHANNELS = {
	get: "palot-artifact:get",
	list: "palot-artifact:list",
	patch: "palot-artifact:patch",
} as const

export function registerPalotArtifactIpc(ipcMain: IpcMain): void {
	ipcMain.handle(PALOT_ARTIFACT_IPC_CHANNELS.get, (_event, sessionId: string, artifactId: string) => {
		return getArtifactStore().getArtifact(sessionId, artifactId)
	})
	ipcMain.handle(PALOT_ARTIFACT_IPC_CHANNELS.list, (_event, sessionId: string) => {
		return getArtifactStore().listArtifacts(sessionId)
	})
	ipcMain.handle(PALOT_ARTIFACT_IPC_CHANNELS.upsert, (_event, sessionId: string, record: GenUiArtifactRecord) => {
		return getArtifactStore().upsertArtifact(sessionId, record)
	})
	ipcMain.handle(
		PALOT_ARTIFACT_IPC_CHANNELS.patch,
		(
			_event,
			sessionId: string,
			artifactId: string,
			input: {
				propsPatch?: Record<string, unknown>
				pin?: GenUiArtifactPinState
				markDirty?: string[]
				lastAgentPatchAt?: number
				lastHumanEditAt?: number
				lastRenderedAt?: number
			},
		): GenUiArtifactRecord | null => {
			return getArtifactStore().patchArtifact({ sessionId, artifactId, ...input })
		},
	)
}
