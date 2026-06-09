/**
 * Jotai atoms for the @ch5me/react-dev-surface dev toolbar toggle.
 *
 * Mirrors the react-scan pattern: persisted toggle read by the renderer
 * to decide whether to wrap the tree in <DevSurfaceProvider>. Toggling
 * requires a page reload because the inspector session binds at mount.
 */

import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

const STORAGE_KEY = "elf:devSurface"

export const devSurfaceStorageAtom = atomWithStorage<boolean>(STORAGE_KEY, false)

export const isDevSurfaceAtom = atom((get) => get(devSurfaceStorageAtom))

export const toggleDevSurfaceAtom = atom(null, (_get, set) => {
	const next = !_get(devSurfaceStorageAtom)
	set(devSurfaceStorageAtom, next)
	setTimeout(() => {
		window.location.reload()
	}, 50)
})
