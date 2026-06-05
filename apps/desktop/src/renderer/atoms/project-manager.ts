import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

export interface ProjectManagerSessionTag {
	sessionId: string
	projectDirectory: string
	projectSlug: string
	projectName: string
	pendingId?: string
	createdAt: number
}

export const projectManagerSessionTagsAtom = atomWithStorage<
	Record<string, ProjectManagerSessionTag>
>("elf:project-manager-session-tags", {})

export const tagProjectManagerSessionAtom = atom(
	null,
	(get, set, tag: ProjectManagerSessionTag) => {
		set(projectManagerSessionTagsAtom, {
			...get(projectManagerSessionTagsAtom),
			[tag.sessionId]: tag,
		})
	},
)

export function isTaggedProjectManagerSession(
	tags: Record<string, ProjectManagerSessionTag>,
	sessionId: string,
): boolean {
	return !!tags[sessionId]
}
