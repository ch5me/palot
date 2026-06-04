import { atom } from "jotai"
import { atomFamily } from "jotai-family"
import type { Event } from "../lib/types"

export type PaneWriter = (text: string) => void

export interface ChatHandle {
	busy: () => boolean
	detach: (notify: boolean) => void
}

type OpenFileInPane = (path: string, name: string) => void
type OpenUrlInPane = (url: string, label?: string) => void
type DragListener = (active: boolean) => void

export const paneWriters = new Map<string, PaneWriter>()
export const paneSubmitters = new Map<string, PaneWriter>()
export const chatHandles = new Map<string, ChatHandle>()
export const paneImageDrop = new Map<string, (paths: string[]) => void>()

export const AIOS_PATH_MIME = "application/x-aios-path"

let openFileImpl: OpenFileInPane | null = null
let openUrlImpl: OpenUrlInPane | null = null
const dragListeners = new Set<DragListener>()
let dragActive = false

export type PaneBusScope =
	| { type: "global" }
	| { type: "session"; sessionId: string }
	| { type: "project"; directory: string }

export interface PaneBusRecord {
	event: Event
	revision: number
	receivedAt: number
}

function setDragActive(active: boolean) {
	if (active === dragActive) {
		return
	}
	dragActive = active
	for (const listener of dragListeners) {
		listener(active)
	}
}

export function registerOpenFile(fn: OpenFileInPane): () => void {
	openFileImpl = fn
	return () => {
		if (openFileImpl === fn) {
			openFileImpl = null
		}
	}
}

export function openFileInPane(path: string, name: string): boolean {
	if (!openFileImpl) {
		return false
	}
	openFileImpl(path, name)
	return true
}

export function registerOpenUrl(fn: OpenUrlInPane): () => void {
	openUrlImpl = fn
	return () => {
		if (openUrlImpl === fn) {
			openUrlImpl = null
		}
	}
}

export function openUrlInPane(url: string, label?: string): boolean {
	if (!openUrlImpl) {
		return false
	}
	openUrlImpl(url, label)
	return true
}

export function onAiosDrag(fn: DragListener): () => void {
	dragListeners.add(fn)
	fn(dragActive)
	return () => {
		dragListeners.delete(fn)
	}
}

function normalizeDirectory(directory: string): string {
	return directory.trim()
}

export function paneBusScopeKey(scope: PaneBusScope): string {
	switch (scope.type) {
		case "global":
			return "global"
		case "session":
			return `session:${scope.sessionId}`
		case "project":
			return `project:${normalizeDirectory(scope.directory)}`
	}
}

function collectScopeKeys(event: Event): string[] {
	const keys = new Set<string>([paneBusScopeKey({ type: "global" })])
	const properties = event.properties as Record<string, unknown>
	const sessionId =
		typeof properties.sessionID === "string"
			? properties.sessionID
			: typeof properties.sessionId === "string"
				? properties.sessionId
				: typeof properties.requestID === "string" && typeof properties.sessionID === "string"
					? properties.sessionID
					: null
	if (sessionId) {
		keys.add(paneBusScopeKey({ type: "session", sessionId }))
	}

	const directory =
		typeof properties.directory === "string"
			? properties.directory
			: typeof properties.info === "object" && properties.info !== null && "directory" in properties.info
				? typeof (properties.info as { directory?: unknown }).directory === "string"
					? ((properties.info as { directory: string }).directory)
					: null
				: null
	if (directory) {
		keys.add(paneBusScopeKey({ type: "project", directory }))
	}

	const part = typeof properties.part === "object" && properties.part !== null ? properties.part as Record<string, unknown> : null
	if (part) {
		if (typeof part.sessionID === "string") {
			keys.add(paneBusScopeKey({ type: "session", sessionId: part.sessionID }))
		}
		if (typeof part.directory === "string") {
			keys.add(paneBusScopeKey({ type: "project", directory: part.directory }))
		}
	}

	return [...keys]
}

export const paneBusFamily = atomFamily((_scopeKey: string) => atom<PaneBusRecord | null>(null))

export const publishPaneBusEventAtom = atom(null, (get, set, event: Event) => {
	for (const scopeKey of collectScopeKeys(event)) {
		const current = get(paneBusFamily(scopeKey))
		set(paneBusFamily(scopeKey), {
			event,
			revision: (current?.revision ?? 0) + 1,
			receivedAt: Date.now(),
		})
	}
})

export function setPaneDragActiveForTests(active: boolean) {
	setDragActive(active)
}

export function resetPaneBusForTests() {
	paneWriters.clear()
	paneSubmitters.clear()
	chatHandles.clear()
	paneImageDrop.clear()
	openFileImpl = null
	openUrlImpl = null
	setDragActive(false)
	dragListeners.clear()
	paneBusFamily.setShouldRemove(() => true)
}

if (typeof window !== "undefined" && !(window as typeof window & { __aiosDragWired?: boolean }).__aiosDragWired) {
	;(window as typeof window & { __aiosDragWired?: boolean }).__aiosDragWired = true
	const arm = () => setDragActive(true)
	const disarm = () => setDragActive(false)
	window.addEventListener("dragenter", arm, true)
	window.addEventListener("dragover", arm, true)
	window.addEventListener("dragend", disarm, true)
	window.addEventListener("drop", disarm, true)
	window.addEventListener(
		"dragleave",
		(event) => {
			if (!(event as DragEvent).relatedTarget) {
				disarm()
			}
		},
		true,
	)
}
