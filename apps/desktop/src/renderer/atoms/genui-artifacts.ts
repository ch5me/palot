import { atom } from "jotai"
import { atomFamily, atomWithStorage } from "jotai/utils"
import type {
	GenUiArtifactDescriptor,
	GenUiArtifactPlacement,
	GenUiArtifactRecord,
	GenUiArtifactSource,
} from "../lib/types"

export interface SessionGenUiArtifactsState {
	order: string[]
	records: Record<string, GenUiArtifactRecord>
}

const EMPTY_SESSION_ARTIFACTS_STATE: SessionGenUiArtifactsState = {
	order: [],
	records: {},
}

function createArtifactId(sessionId: string): string {
	const seed = crypto.randomUUID().replace(/-/g, "").slice(0, 8)
	return `artifact_${sessionId.slice(0, 6)}_${Date.now().toString(36)}_${seed}`
}

function buildArtifactTitle(descriptor: GenUiArtifactDescriptor): string {
	const provided = descriptor.title?.trim()
	if (provided) {
		return provided
	}

	const normalized = descriptor.component
		.split(/[-_]+/g)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ")

	return normalized || "GenUI artifact"
}

export const sessionGenUiArtifactsStorageAtom = atomWithStorage<Record<string, SessionGenUiArtifactsState>>(
	"elf:genui-artifacts",
	{},
)

export const sessionGenUiArtifactsFamily = atomFamily((sessionId: string) =>
	atom(
		(get) => get(sessionGenUiArtifactsStorageAtom)[sessionId] ?? EMPTY_SESSION_ARTIFACTS_STATE,
		(get, set, nextState: SessionGenUiArtifactsState) => {
			set(sessionGenUiArtifactsStorageAtom, {
				...get(sessionGenUiArtifactsStorageAtom),
				[sessionId]: nextState,
			})
		},
	),
)

export const sessionGenUiArtifactListFamily = atomFamily((sessionId: string) =>
	atom((get) => {
		const state = get(sessionGenUiArtifactsFamily(sessionId))
		return state.order
			.map((artifactId) => state.records[artifactId])
			.filter((record): record is GenUiArtifactRecord => !!record)
	}),
)

export const pinnedGenUiArtifactListFamily = atomFamily((sessionId: string) =>
	atom((get) =>
		get(sessionGenUiArtifactListFamily(sessionId)).filter((artifact) => artifact.pin.pinned),
	),
)

export const genUiArtifactByIdFamily = atomFamily((args: { sessionId: string; artifactId: string }) =>
	atom((get) => get(sessionGenUiArtifactsFamily(args.sessionId)).records[args.artifactId] ?? null),
)

export const upsertGenUiArtifactAtom = atom(
	null,
	(
		get,
		set,
		args: {
			sessionId: string
			descriptor: GenUiArtifactDescriptor
			source: GenUiArtifactSource
			artifactId?: string
		},
	) => {
		const state = get(sessionGenUiArtifactsFamily(args.sessionId))
		const now = Date.now()
		const artifactId = args.artifactId ?? createArtifactId(args.sessionId)
		const existing = state.records[artifactId]
		const nextRecord: GenUiArtifactRecord = {
			id: artifactId,
			scope: "session",
			title: buildArtifactTitle(args.descriptor),
			component: args.descriptor.component,
			props: args.descriptor.props,
			source: args.source,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
			lastRenderedAt: now,
			pin: existing?.pin ?? {
				pinned: false,
				placement: null,
				pinnedAt: null,
			},
		}

		set(sessionGenUiArtifactsFamily(args.sessionId), {
			order: existing ? state.order : [artifactId, ...state.order],
			records: {
				...state.records,
				[artifactId]: nextRecord,
			},
		})

		return artifactId
	},
)

export const pinGenUiArtifactAtom = atom(
	null,
	(
		get,
		set,
		args: {
			sessionId: string
			artifactId: string
			placement: Exclude<GenUiArtifactPlacement, "inline"> | null
			pinned: boolean
		},
	) => {
		const state = get(sessionGenUiArtifactsFamily(args.sessionId))
		const existing = state.records[args.artifactId]
		if (!existing) {
			return
		}
		const now = Date.now()
		set(sessionGenUiArtifactsFamily(args.sessionId), {
			...state,
			records: {
				...state.records,
				[args.artifactId]: {
					...existing,
					updatedAt: now,
					pin: {
						pinned: args.pinned,
						placement: args.pinned ? args.placement : null,
						pinnedAt: args.pinned ? now : null,
					},
				},
			},
		})
	},
)

export const patchGenUiArtifactPropsAtom = atom(
	null,
	(
		get,
		set,
		args: {
			sessionId: string
			artifactId: string
			propsPatch: Record<string, unknown>
		},
	) => {
		const state = get(sessionGenUiArtifactsFamily(args.sessionId))
		const existing = state.records[args.artifactId]
		if (!existing) {
			return
		}
		set(sessionGenUiArtifactsFamily(args.sessionId), {
			...state,
			records: {
				...state.records,
				[args.artifactId]: {
					...existing,
					props: {
						...existing.props,
						...args.propsPatch,
					},
					updatedAt: Date.now(),
				},
			},
		})
	},
)

export const unpinAllGenUiArtifactsForPlacementAtom = atom(
	null,
	(
		get,
		set,
		args: {
			sessionId: string
			placement: Exclude<GenUiArtifactPlacement, "inline">
		},
	) => {
		const state = get(sessionGenUiArtifactsFamily(args.sessionId))
		let changed = false
		const nextRecords: Record<string, GenUiArtifactRecord> = {}
		for (const [artifactId, artifact] of Object.entries(state.records)) {
			if (artifact.pin.pinned && artifact.pin.placement === args.placement) {
				changed = true
				nextRecords[artifactId] = {
					...artifact,
					updatedAt: Date.now(),
					pin: {
						pinned: false,
						placement: null,
						pinnedAt: null,
					},
				}
			} else {
				nextRecords[artifactId] = artifact
			}
		}
		if (!changed) {
			return
		}
		set(sessionGenUiArtifactsFamily(args.sessionId), {
			...state,
			records: nextRecords,
		})
	},
)
