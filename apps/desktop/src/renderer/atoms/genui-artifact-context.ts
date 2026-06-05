import { atom } from "jotai"
import { atomFamily } from "jotai/utils"

export interface SessionArtifactPromptContext {
	enabled: boolean
	lastInjectedAt: number | null
}

export const sessionArtifactPromptContextFamily = atomFamily((_sessionId: string) =>
	atom<SessionArtifactPromptContext>({
		enabled: true,
		lastInjectedAt: null,
	}),
)

export const markArtifactPromptContextInjectedAtom = atom(
	null,
	(_get, set, sessionId: string) => {
		set(sessionArtifactPromptContextFamily(sessionId), {
			enabled: true,
			lastInjectedAt: Date.now(),
		})
	},
)
