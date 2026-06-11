import { atom } from "jotai"
import { atomFamily, atomWithStorage } from "jotai/utils"

import { mintArtifactId } from "../../shared/loom/artifact-id"
import {
	fetchArtifactRecord,
	fetchArtifactRecords,
	patchArtifactRecord,
	upsertArtifactRecord,
} from "../services/backend"
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

function createArtifactRecord(
	descriptor: GenUiArtifactDescriptor,
	source: GenUiArtifactSource,
	existing?: GenUiArtifactRecord,
	artifactId?: string,
): GenUiArtifactRecord {
	const now = Date.now()
	return {
		id: artifactId ?? existing?.id ?? mintArtifactId(),
		scope: "session",
		title: buildArtifactTitle(descriptor),
		component: descriptor.component,
		props: descriptor.props,
		source,
		createdAt: existing?.createdAt ?? now,
		updatedAt: now,
		lastRenderedAt: now,
		pin: existing?.pin ?? {
			pinned: false,
			placement: null,
			pinnedAt: null,
		},
		version: existing?.version ?? 1,
		dirty: existing?.dirty ?? [],
		lastAgentPatchAt: existing?.lastAgentPatchAt ?? 0,
		lastHumanEditAt: existing?.lastHumanEditAt ?? 0,
		schemaVersion: 1,
	}
}

async function syncArtifactList(sessionId: string): Promise<SessionGenUiArtifactsState | null> {
	const remote = await fetchArtifactRecords(sessionId)
	return remote ?? null
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

export const hydrateGenUiArtifactsAtom = atom(null, async (_get, set, sessionId: string) => {
	const synced = await syncArtifactList(sessionId)
	if (!synced) return
	set(sessionGenUiArtifactsFamily(sessionId), synced)
})

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

export const refreshGenUiArtifactAtom = atom(
	null,
	async (get, set, args: { sessionId: string; artifactId: string }) => {
		const record = await fetchArtifactRecord(args.sessionId, args.artifactId)
		if (!record) return
		const state = get(sessionGenUiArtifactsFamily(args.sessionId))
		set(sessionGenUiArtifactsFamily(args.sessionId), {
			order: state.order.includes(record.id) ? state.order : [record.id, ...state.order],
			records: {
				...state.records,
				[record.id]: record,
			},
		})
	},
)

export const upsertGenUiArtifactAtom = atom(
	null,
	async (
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
		const existing = args.artifactId ? state.records[args.artifactId] : undefined
		const nextRecord = createArtifactRecord(args.descriptor, args.source, existing, args.artifactId)
		set(sessionGenUiArtifactsFamily(args.sessionId), {
			order: existing ? state.order : [nextRecord.id, ...state.order],
			records: {
				...state.records,
				[nextRecord.id]: nextRecord,
			},
		})
		await upsertArtifactRecord(args.sessionId, nextRecord)
		return nextRecord.id
	},
)

export const pinGenUiArtifactAtom = atom(
	null,
	async (
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
		if (!existing) return
		const now = Date.now()
		const pin = {
			pinned: args.pinned,
			placement: args.pinned ? args.placement : null,
			pinnedAt: args.pinned ? now : null,
		}
		set(sessionGenUiArtifactsFamily(args.sessionId), {
			...state,
			records: {
				...state.records,
				[args.artifactId]: {
					...existing,
					updatedAt: now,
					pin,
				},
			},
		})
		await patchArtifactRecord(args.sessionId, args.artifactId, { pin })
	},
)

export const patchGenUiArtifactPropsAtom = atom(
	null,
	async (
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
		if (!existing) return
		const updatedAt = Date.now()
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
					updatedAt,
					lastHumanEditAt: updatedAt,
				},
			},
		})
		await patchArtifactRecord(args.sessionId, args.artifactId, {
			propsPatch: args.propsPatch,
			lastHumanEditAt: updatedAt,
		})
	},
)

export const unpinAllGenUiArtifactsForPlacementAtom = atom(
	null,
	async (
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
				const updatedAt = Date.now()
				nextRecords[artifactId] = {
					...artifact,
					updatedAt,
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
		if (!changed) return
		set(sessionGenUiArtifactsFamily(args.sessionId), {
			...state,
			records: nextRecords,
		})
		await Promise.all(
			Object.entries(nextRecords)
				.filter(([, artifact]) => !artifact.pin.pinned)
				.map(([artifactId, artifact]) => patchArtifactRecord(args.sessionId, artifactId, { pin: artifact.pin })),
		)
	},
)
